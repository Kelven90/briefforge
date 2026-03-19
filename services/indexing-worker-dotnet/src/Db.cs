using Microsoft.Extensions.Options;
using Npgsql;

namespace BriefForge.IndexingWorker;

public sealed class Db
{
    private readonly WorkerOptions _opt;

    public Db(IOptions<WorkerOptions> opt)
    {
        _opt = opt.Value;
    }

    public async Task<NpgsqlConnection> OpenAsync(CancellationToken ct)
    {
        var connString = NormalizeDatabaseUrlToConnectionString(_opt.DatabaseUrl);
        var conn = new NpgsqlConnection(connString);
        await conn.OpenAsync(ct);
        return conn;
    }

    // GitHub Actions and many setups use DATABASE_URL (URL form). Npgsql prefers keyword form.
    private static string NormalizeDatabaseUrlToConnectionString(string databaseUrl)
    {
        if (string.IsNullOrWhiteSpace(databaseUrl)) return databaseUrl;
        if (!databaseUrl.StartsWith("postgres", StringComparison.OrdinalIgnoreCase)) return databaseUrl;

        var uri = new Uri(databaseUrl);
        var userInfo = uri.UserInfo.Split(':', 2);
        var username = Uri.UnescapeDataString(userInfo.ElementAtOrDefault(0) ?? "");
        var password = Uri.UnescapeDataString(userInfo.ElementAtOrDefault(1) ?? "");
        var database = uri.AbsolutePath.TrimStart('/');
        var host = uri.Host;
        var port = uri.Port;

        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = host,
            Port = port,
            Username = username,
            Password = password,
            Database = database,
            SslMode = SslMode.Disable
        };

        return builder.ConnectionString;
    }
}

