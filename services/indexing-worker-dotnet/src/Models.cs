namespace BriefForge.IndexingWorker;

public sealed record ClaimedJob(
    Guid Id,
    Guid WorkspaceId,
    Guid? SourceId,
    string JobType,
    int Attempts,
    DateTimeOffset? CreatedAt
);

public sealed record SourceRow(
    Guid Id,
    Guid WorkspaceId,
    string FileName,
    string FileType,
    string StoragePath,
    string Status,
    string TrustLevel
);

public sealed record ChunkRow(Guid Id, int ChunkIndex, string ChunkText);

