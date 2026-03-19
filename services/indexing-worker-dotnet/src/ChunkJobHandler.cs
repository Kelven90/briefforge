using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;

namespace BriefForge.IndexingWorker;

public sealed class ChunkJobHandler
{
    private readonly ILogger<ChunkJobHandler> _log;
    private readonly WorkerOptions _opt;
    private readonly Db _db;
    private readonly Chunker _chunker;

    public ChunkJobHandler(
        ILogger<ChunkJobHandler> log,
        IOptions<WorkerOptions> opt,
        Db db,
        Chunker chunker
    )
    {
        _log = log;
        _opt = opt.Value;
        _db = db;
        _chunker = chunker;
    }

    public async Task HandleAsync(ClaimedJob job, CancellationToken ct)
    {
        if (job.SourceId is null) throw new InvalidOperationException("Chunk job missing sourceId");

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
            await CompleteJob(conn, job.Id, success: false, ct);
            await tx.CommitAsync(ct);
            return;
        }

        var segments = _chunker.Chunk(content, _opt.ChunkSizeChars, _opt.ChunkOverlapChars);
        _log.LogInformation("Chunking source {SourceId} into {Count} chunks", source.Id, segments.Count);

        // Minimal idempotency: replace chunks for this source.
        await DeleteChunksForSource(conn, source.Id, ct);

        for (var idx = 0; idx < segments.Count; idx++)
        {
            var segment = segments[idx];
            var tokenCount = CountTokens(segment);
            await InsertChunk(conn, source.Id, source.WorkspaceId, segment, idx, tokenCount, ct);
        }

        await EnqueueNextJob(conn, source.WorkspaceId, source.Id, "embed", ct);
        await CompleteJob(conn, job.Id, success: true, ct);
        await tx.CommitAsync(ct);
    }

    private static int CountTokens(string text)
    {
        // Rough approximation: whitespace tokens
        return text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).Length;
    }

    private async Task DeleteChunksForSource(NpgsqlConnection conn, Guid sourceId, CancellationToken ct)
    {
        var sql = "delete from public.chunks where source_id = $1";
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue(sourceId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private async Task InsertChunk(
        NpgsqlConnection conn,
        Guid sourceId,
        Guid workspaceId,
        string text,
        int chunkIndex,
        int tokenCount,
        CancellationToken ct
    )
    {
        var sql = """
                  insert into public.chunks (source_id, workspace_id, chunk_text, chunk_index, token_count)
                  values ($1, $2, $3, $4, $5)
                  """;
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue(sourceId);
        cmd.Parameters.AddWithValue(workspaceId);
        cmd.Parameters.AddWithValue(text);
        cmd.Parameters.AddWithValue(chunkIndex);
        cmd.Parameters.AddWithValue(tokenCount);
        await cmd.ExecuteNonQueryAsync(ct);
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
        var repoRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
        return Path.Combine(repoRoot, "storage");
    }
}

