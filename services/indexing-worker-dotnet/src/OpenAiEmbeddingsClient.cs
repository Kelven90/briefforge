using System.Globalization;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BriefForge.IndexingWorker;

public sealed class OpenAiEmbeddingsClient
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly WorkerOptions _opt;
    private readonly ILogger<OpenAiEmbeddingsClient> _log;

    public OpenAiEmbeddingsClient(
        IHttpClientFactory httpClientFactory,
        IOptions<WorkerOptions> opt,
        ILogger<OpenAiEmbeddingsClient> log
    )
    {
        _httpClientFactory = httpClientFactory;
        _opt = opt.Value;
        _log = log;
    }

    public async Task<IReadOnlyList<float[]>> EmbedAsync(IReadOnlyList<string> inputs, CancellationToken ct)
    {
        if (_opt.DisableLlm)
            throw new InvalidOperationException("DisableLlm is true; embeddings are disabled.");

        if (string.IsNullOrWhiteSpace(_opt.OpenAiApiKey))
            throw new InvalidOperationException("OpenAiApiKey is not set.");

        var client = _httpClientFactory.CreateClient("openai");
        client.BaseAddress = new Uri("https://api.openai.com/");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _opt.OpenAiApiKey);

        var req = new
        {
            model = _opt.OpenAiEmbeddingModel,
            input = inputs
        };

        var res = await client.PostAsJsonAsync("v1/embeddings", req, cancellationToken: ct);
        if (!res.IsSuccessStatusCode)
        {
            var body = await res.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"OpenAI embeddings failed: {(int)res.StatusCode} {body}");
        }

        var payload = await res.Content.ReadFromJsonAsync<EmbeddingsResponse>(cancellationToken: ct);
        if (payload?.Data is null || payload.Data.Count != inputs.Count)
            throw new InvalidOperationException("OpenAI embeddings response shape unexpected.");

        return payload.Data
            .OrderBy(d => d.Index)
            .Select(d => d.Embedding)
            .ToArray();
    }

    public static string ToPgVectorLiteral(float[] embedding)
    {
        // pgvector accepts: '[1,2,3]'::vector
        return "[" + string.Join(",", embedding.Select(f => f.ToString("G9", CultureInfo.InvariantCulture))) + "]";
    }

    private sealed class EmbeddingsResponse
    {
        public List<EmbeddingsDatum> Data { get; set; } = new();
    }

    private sealed class EmbeddingsDatum
    {
        public int Index { get; set; }
        public float[] Embedding { get; set; } = Array.Empty<float>();
    }
}

