using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;

namespace BriefForge.IndexingWorker;

public sealed class EmbedJobHandler
{
    private readonly ILogger<EmbedJobHandler> _log;
    private readonly WorkerOptions _opt;
    private readonly Db _db;
    private readonly OpenAiEmbeddingsClient _embeddings;

    public EmbedJobHandler(
        ILogger<EmbedJobHandler> log,
        IOptions<WorkerOptions> opt,
        Db db,
        OpenAiEmbeddingsClient embeddings
    )
    {
        _log = log;
        _opt = opt.Value;
        _db = db;
        _embeddings = embeddings;
    }

    public async Task HandleAsync(ClaimedJob job, CancellationToken ct)
    {
        if (job.SourceId is null) throw new InvalidOperationException("Embed job missing sourceId");

        if (_opt.DisableLlm)
        {
            _log.LogWarning("DisableLlm=true; cannot embed. Marking job failed.");
            await using var connFail = await _db.OpenAsync(ct);
            await CompleteJob(connFail, job.Id, success: false, ct);
            return;
        }

        await using var conn = await _db.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var source = await LoadSource(conn, job.SourceId.Value, ct);

        var totalEmbedded = 0;
        while (true)
        {
            var batch = await LoadUnembeddedChunks(conn, source.Id, _opt.EmbedBatchSize, ct);
            if (batch.Count == 0) break;

            var inputs = batch.Select(c => c.ChunkText).ToArray();
            var vectors = await _embeddings.EmbedAsync(inputs, ct);

            for (var i = 0; i < batch.Count; i++)
            {
                var vecLiteral = OpenAiEmbeddingsClient.ToPgVectorLiteral(vectors[i]);
                await UpdateChunkEmbedding(conn, batch[i].Id, vecLiteral, ct);
            }

            totalEmbedded += batch.Count;
            _log.LogInformation("Embedded {Count} chunks for source {SourceId}", batch.Count, source.Id);
        }

        await UpdateSourceStatus(conn, source.Id, "indexed", ct);
        await CompleteJob(conn, job.Id, success: true, ct);
        await tx.CommitAsync(ct);

        _log.LogInformation("Embed job completed for source {SourceId} (embeddedChunks={Embedded})", source.Id, totalEmbedded);
    }

    private async Task<List<(Guid Id, int ChunkIndex, string ChunkText)>> LoadUnembeddedChunks(
        NpgsqlConnection conn,
        Guid sourceId,
        int limit,
        CancellationToken ct
    )
    {
        var sql = """
                  select id, chunk_index, chunk_text
                  from public.chunks
                  where source_id = $1 and embedding is null
                  order by chunk_index asc
                  limit $2
                  """;
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue(sourceId);
        cmd.Parameters.AddWithValue(limit);
        await using var reader = await cmd.ExecuteReaderAsync(ct);

        var rows = new List<(Guid, int, string)>();
        while (await reader.ReadAsync(ct))
        {
            rows.Add((reader.GetGuid(0), reader.GetInt32(1), reader.GetString(2)));
        }
        return rows;
    }

    private async Task UpdateChunkEmbedding(NpgsqlConnection conn, Guid chunkId, string vectorLiteral, CancellationToken ct)
    {
        var sql = "update public.chunks set embedding = $1::vector where id = $2";
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue(vectorLiteral);
        cmd.Parameters.AddWithValue(chunkId);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private async Task UpdateSourceStatus(NpgsqlConnection conn, Guid sourceId, string status, CancellationToken ct)
    {
        var sql = "update public.sources set status = $1::source_status where id = $2";
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue(status);
        cmd.Parameters.AddWithValue(sourceId);
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
}

