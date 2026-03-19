using System.ComponentModel.DataAnnotations;

namespace BriefForge.IndexingWorker;

public sealed class WorkerOptions
{
    [Required]
    public string DatabaseUrl { get; set; } = string.Empty;

    public string StorageRoot { get; set; } = "";

    public string OpenAiApiKey { get; set; } = "";

    public string OpenAiEmbeddingModel { get; set; } = "text-embedding-3-small";

    public bool DisableLlm { get; set; } = false;

    [Range(1, 1000)]
    public int PollIntervalMs { get; set; } = 750;

    [Range(1, 60)]
    public int JobVisibilityTimeoutSeconds { get; set; } = 60;

    [Range(1, 1000)]
    public int EmbedBatchSize { get; set; } = 32;

    [Range(100, 100000)]
    public int ChunkSizeChars { get; set; } = 1600;

    [Range(0, 100000)]
    public int ChunkOverlapChars { get; set; } = 250;
}

