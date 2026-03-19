using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Polly;

namespace BriefForge.IndexingWorker;

public sealed class JobWorker : BackgroundService
{
    private readonly ILogger<JobWorker> _log;
    private readonly WorkerOptions _opt;
    private readonly Db _db;
    private readonly ParseJobHandler _parse;
    private readonly ChunkJobHandler _chunk;
    private readonly EmbedJobHandler _embed;

    public JobWorker(
        ILogger<JobWorker> log,
        IOptions<WorkerOptions> opt,
        Db db,
        ParseJobHandler parse,
        ChunkJobHandler chunk,
        EmbedJobHandler embed
    )
    {
        _log = log;
        _opt = opt.Value;
        _db = db;
        _parse = parse;
        _chunk = chunk;
        _embed = embed;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _log.LogInformation("DotNet indexing worker started (pollIntervalMs={PollIntervalMs})", _opt.PollIntervalMs);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var claimed = await ClaimNextJob(stoppingToken);
                if (claimed is null)
                {
                    await Task.Delay(_opt.PollIntervalMs, stoppingToken);
                    continue;
                }

                using var activity = _log.BeginScope(new Dictionary<string, object?>
                {
                    ["jobId"] = claimed.Id,
                    ["jobType"] = claimed.JobType,
                    ["workspaceId"] = claimed.WorkspaceId,
                    ["sourceId"] = claimed.SourceId
                });

                _log.LogInformation("Claimed job {JobId} type={JobType} attempts={Attempts}", claimed.Id, claimed.JobType, claimed.Attempts);

                var policy = Policy
                    .Handle<Exception>()
                    .WaitAndRetryAsync(
                        retryCount: 2,
                        sleepDurationProvider: attempt => TimeSpan.FromSeconds(Math.Pow(2, attempt)),
                        onRetry: (ex, delay, attempt, _) =>
                        {
                            _log.LogWarning(ex, "Retrying job handler attempt={Attempt} delay={Delay}", attempt, delay);
                        }
                    );

                await policy.ExecuteAsync(async () =>
                {
                    switch (claimed.JobType)
                    {
                        case "parse":
                            await _parse.HandleAsync(claimed, stoppingToken);
                            break;
                        case "chunk":
                            await _chunk.HandleAsync(claimed, stoppingToken);
                            break;
                        case "embed":
                            await _embed.HandleAsync(claimed, stoppingToken);
                            break;
                        default:
                            _log.LogWarning("Unknown job type: {JobType}. Marking failed.", claimed.JobType);
                            await MarkJobFailed(claimed.Id, stoppingToken);
                            break;
                    }
                });
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // shutdown
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Worker loop error");
                await Task.Delay(1000, stoppingToken);
            }
        }
    }

    private async Task<ClaimedJob?> ClaimNextJob(CancellationToken ct)
    {
        await using var conn = await _db.OpenAsync(ct);

        // Atomic claim: pick oldest queued job, mark running, bump attempts, set started_at.
        // Uses SKIP LOCKED so multiple workers can run safely.
        var sql = """
                  with next_job as (
                    select id
                    from public.jobs
                    where status = 'queued'
                    order by created_at asc
                    for update skip locked
                    limit 1
                  )
                  update public.jobs j
                  set status = 'running',
                      attempts = j.attempts + 1,
                      started_at = now()
                  from next_job
                  where j.id = next_job.id
                  returning
                    j.id,
                    j.workspace_id,
                    j.source_id,
                    j.job_type::text,
                    j.attempts,
                    j.created_at;
                  """;

        await using var cmd = new Npgsql.NpgsqlCommand(sql, conn);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new ClaimedJob(
            reader.GetGuid(0),
            reader.GetGuid(1),
            reader.IsDBNull(2) ? null : reader.GetGuid(2),
            reader.GetString(3),
            reader.GetInt32(4),
            reader.IsDBNull(5) ? null : reader.GetFieldValue<DateTimeOffset>(5)
        );
    }

    private async Task MarkJobFailed(Guid jobId, CancellationToken ct)
    {
        await using var conn = await _db.OpenAsync(ct);
        var sql = "update public.jobs set status = 'failed', completed_at = now() where id = $1";
        await using var cmd = new Npgsql.NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue(jobId);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}

