using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;

namespace BriefForge.IndexingWorker;

public sealed class ParseJobHandler
{
    private readonly ILogger<ParseJobHandler> _log;
    private readonly WorkerOptions _opt;
    private readonly Db _db;

    public ParseJobHandler(ILogger<ParseJobHandler> log, IOptions<WorkerOptions> opt, Db db)
    {
        _log = log;
        _opt = opt.Value;
        _db = db;
    }

    public async Task HandleAsync(ClaimedJob job, CancellationToken ct)
    {
        if (job.SourceId is null) throw new InvalidOperationException("Parse job missing sourceId");

        await using var conn = await _db.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var source = await LoadSource(conn, job.SourceId.Value, ct);
        var storageRoot = ResolveStorageRoot();
        var fullPath = Path.Combine(storageRoot, source.StoragePath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));

        string content;
        try
        {
            content = await File.ReadAllTextAsync(fullPath, ct);
        }
        catch (FileNotFoundException)
        {
            _log.LogWarning("Source file not found: {FullPath}", fullPath);
            await UpdateSourceStatus(conn, source.Id, "failed", ct);
            await CompleteJob(conn, job.Id, success: false, ct);
            await tx.CommitAsync(ct);
            return;
        }

        var normalized = Chunker.NormalizeText(content);
        _log.LogInformation("Parsed source {SourceId} ({Chars} chars)", source.Id, normalized.Length);

        await UpdateSourceStatus(conn, source.Id, "parsing", ct);

        // Fan-out next stage: chunk job queued
        await EnqueueNextJob(conn, source.WorkspaceId, source.Id, "chunk", ct);

        await CompleteJob(conn, job.Id, success: true, ct);
        await tx.CommitAsync(ct);
    }

    private async Task<SourceRow> LoadSource(NpgsqlConnection conn, Guid sourceId, CancellationToken ct)
    {
        const string sql = """
                           select
                             id,
                             workspace_id,
                             file_name,
                             file_type,
                             storage_path,
                             status::text,
                             trust_level::text
                           from public.sources
                           where id = $1
                           limit 1
                           """;
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue(sourceId);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct))
            throw new InvalidOperationException($"Source not found: {sourceId}");

        return new SourceRow(
            reader.GetGuid(0),
            reader.GetGuid(1),
            reader.GetString(2),
            reader.GetString(3),
            reader.GetString(4),
            reader.GetString(5),
            reader.GetString(6)
        );
    }

    private async Task UpdateSourceStatus(NpgsqlConnection conn, Guid sourceId, string status, CancellationToken ct)
    {
        var sql = "update public.sources set status = $1::source_status where id = $2";
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue(status);
        cmd.Parameters.AddWithValue(sourceId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private async Task EnqueueNextJob(NpgsqlConnection conn, Guid workspaceId, Guid sourceId, string jobType, CancellationToken ct)
    {
        var sql = "insert into public.jobs (workspace_id, source_id, job_type, status) values ($1, $2, $3::job_type, 'queued')";
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue(workspaceId);
        cmd.Parameters.AddWithValue(sourceId);
        cmd.Parameters.AddWithValue(jobType);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private async Task CompleteJob(NpgsqlConnection conn, Guid jobId, bool success, CancellationToken ct)
    {
        var status = success ? "completed" : "failed";
        var sql = "update public.jobs set status = $1::job_status, completed_at = now() where id = $2";
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue(status);
        cmd.Parameters.AddWithValue(jobId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private string ResolveStorageRoot()
    {
        if (!string.IsNullOrWhiteSpace(_opt.StorageRoot)) return _opt.StorageRoot;
        // Default matches Python worker: repoRoot/storage (this service lives at services/indexing-worker-dotnet)
        var repoRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
        return Path.Combine(repoRoot, "storage");
    }
}

