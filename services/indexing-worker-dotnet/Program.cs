using BriefForge.IndexingWorker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateLogger();

try
{
    var builder = Host.CreateApplicationBuilder(args);
    builder.Logging.ClearProviders();
    builder.Services.AddSerilog(Log.Logger, dispose: true);

    builder.Services.AddOptions<WorkerOptions>()
        .Bind(builder.Configuration.GetSection(nameof(WorkerOptions)))
        .PostConfigure(o =>
        {
            // Convenience: allow existing repo env var names (DATABASE_URL, OPENAI_API_KEY, etc.)
            if (string.IsNullOrWhiteSpace(o.DatabaseUrl))
                o.DatabaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL") ?? o.DatabaseUrl;
            if (string.IsNullOrWhiteSpace(o.OpenAiApiKey))
                o.OpenAiApiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY") ?? o.OpenAiApiKey;
            if (string.IsNullOrWhiteSpace(o.OpenAiEmbeddingModel))
                o.OpenAiEmbeddingModel = Environment.GetEnvironmentVariable("OPENAI_EMBEDDING_MODEL") ?? o.OpenAiEmbeddingModel;
            if (string.IsNullOrWhiteSpace(o.StorageRoot))
                o.StorageRoot = Environment.GetEnvironmentVariable("STORAGE_ROOT") ?? o.StorageRoot;

            var disable = Environment.GetEnvironmentVariable("BRIEFFORGE_DISABLE_LLM");
            if (!string.IsNullOrWhiteSpace(disable) && (disable == "1" || disable.Equals("true", StringComparison.OrdinalIgnoreCase)))
                o.DisableLlm = true;
        })
        .ValidateDataAnnotations()
        .ValidateOnStart();

    builder.Services.AddHttpClient("openai");

    builder.Services.AddSingleton<Db>();
    builder.Services.AddSingleton<Chunker>();
    builder.Services.AddSingleton<OpenAiEmbeddingsClient>();
    builder.Services.AddSingleton<ParseJobHandler>();
    builder.Services.AddSingleton<ChunkJobHandler>();
    builder.Services.AddSingleton<EmbedJobHandler>();

    builder.Services.AddHostedService<JobWorker>();

    var app = builder.Build();
    await app.RunAsync();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Worker terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}

