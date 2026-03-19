using System.Text;

namespace BriefForge.IndexingWorker;

public sealed class Chunker
{
    public IReadOnlyList<string> Chunk(string text, int maxChars, int overlapChars)
    {
        var normalized = NormalizeText(text);
        if (string.IsNullOrWhiteSpace(normalized)) return Array.Empty<string>();

        var chunks = new List<string>();
        var start = 0;
        var length = normalized.Length;

        while (start < length)
        {
            var end = Math.Min(start + maxChars, length);
            var chunk = normalized[start..end].Trim();
            if (!string.IsNullOrWhiteSpace(chunk))
                chunks.Add(chunk);

            if (end == length) break;
            start = Math.Max(0, end - overlapChars);
        }

        return chunks;
    }

    public static string NormalizeText(string raw)
    {
        var sb = new StringBuilder(raw.Length);
        using var reader = new StringReader(raw);
        string? line;
        var first = true;
        while ((line = reader.ReadLine()) is not null)
        {
            var trimmed = line.Trim();
            if (trimmed.Length == 0) continue;
            if (!first) sb.Append('\n');
            sb.Append(trimmed);
            first = false;
        }
        return sb.ToString();
    }
}

