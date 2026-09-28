using MediStock.Api.Infrastructure.Persistence;
using MediStock.Api.Infrastructure.Persistence.Identity;
using MediStock.Api.Security;
using Microsoft.EntityFrameworkCore;

namespace MediStock.Api.Features.Auth.Services;

public sealed class RefreshTokenService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly JwtTokenService _jwtTokenService;
    private readonly JwtConfiguration? _configuration;

    public RefreshTokenService(
        ApplicationDbContext dbContext,
        JwtTokenService jwtTokenService,
        JwtConfiguration? configuration = null)
    {
        _dbContext = dbContext;
        _jwtTokenService = jwtTokenService;
        _configuration = configuration;
    }

    public async Task<string> CreateAsync(
        ApplicationUser user,
        CancellationToken cancellationToken = default)
    {
        var refreshToken =
            _jwtTokenService.CreateRefreshToken();

        var tokenHash =
            _jwtTokenService.HashRefreshToken(refreshToken);

        var expirationDays = _configuration?.RefreshTokenExpirationDays > 0
            ? _configuration.RefreshTokenExpirationDays
            : 7;

        var entity = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = tokenHash,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(expirationDays)
        };

        _dbContext.RefreshTokens.Add(entity);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return refreshToken;
    }

    public async Task<RefreshToken?> FindActiveAsync(
        string refreshToken,
        CancellationToken cancellationToken = default)
    {
        var tokenHash =
            _jwtTokenService.HashRefreshToken(refreshToken);

        var entity = await _dbContext.RefreshTokens
            .Include(token => token.User)
            .SingleOrDefaultAsync(
                token => token.TokenHash == tokenHash,
                cancellationToken);

        if (entity is null)
        {
            return null;
        }

        if (entity.RevokedAt is not null)
        {
            return null;
        }

        if (entity.ExpiresAt <= DateTime.UtcNow)
        {
            return null;
        }

        return entity;
    }

    public async Task RevokeAsync(
        RefreshToken refreshToken,
        CancellationToken cancellationToken = default)
    {
        refreshToken.RevokedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}