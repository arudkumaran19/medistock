using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using MediStock.Api.Security;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace MediStock.UnitTests;

public sealed class JwtConfigurationAndAuthenticationTests
{
    private const string ValidKey = "ThisIsASecretKeyForTestingJwtAuthenticationWithAtLeast64CharactersLong123!";
    private const string ValidIssuer = "MediStock.Api";
    private const string ValidAudience = "MediStock.Client";

    [Fact]
    public void JwtConfiguration_DefaultExpirationValues_AreSensible()
    {
        var config = new JwtConfiguration();

        Assert.Equal(60, config.AccessTokenExpirationMinutes);
        Assert.Equal(7, config.RefreshTokenExpirationDays);
        Assert.Equal(string.Empty, config.Issuer);
        Assert.Equal(string.Empty, config.Audience);
        Assert.Equal(string.Empty, config.SigningKey);
    }

    [Theory]
    [InlineData("", "Audience", ValidKey)]
    [InlineData("Issuer", "", ValidKey)]
    [InlineData("Issuer", "Audience", "")]
    [InlineData("Issuer", "Audience", "too-short-key")]
    public void JwtConfiguration_Validation_DetectsInvalidSettings(string issuer, string audience, string signingKey)
    {
        var config = new JwtConfiguration
        {
            Issuer = issuer,
            Audience = audience,
            SigningKey = signingKey
        };

        var isInvalid = string.IsNullOrWhiteSpace(config.Issuer) ||
                        string.IsNullOrWhiteSpace(config.Audience) ||
                        string.IsNullOrWhiteSpace(config.SigningKey) ||
                        config.SigningKey.Length < 32;

        Assert.True(isInvalid);
    }

    [Fact]
    public void ValidToken_PassesValidation_WithCorrectClaimsAndRoles()
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(ValidKey));

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Issuer = ValidIssuer,
            Audience = ValidAudience,
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
                new Claim(ClaimTypes.Email, "manager@medistock.com"),
                new Claim(ClaimTypes.Role, "FACILITY_MANAGER")
            }),
            Expires = DateTime.UtcNow.AddMinutes(30),
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(token);

        var validationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = ValidIssuer,
            ValidateAudience = true,
            ValidAudience = ValidAudience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = key,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };

        var principal = tokenHandler.ValidateToken(tokenString, validationParameters, out var validatedToken);

        Assert.NotNull(validatedToken);
        Assert.True(principal.IsInRole("FACILITY_MANAGER"));
        Assert.False(principal.IsInRole("ADMIN"));
        Assert.Equal("manager@medistock.com", principal.FindFirst(ClaimTypes.Email)?.Value);
    }

    [Fact]
    public void ExpiredToken_FailsValidation()
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(ValidKey));

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Issuer = ValidIssuer,
            Audience = ValidAudience,
            Subject = new ClaimsIdentity(new[] { new Claim(ClaimTypes.Role, "STORE_OFFICER") }),
            NotBefore = DateTime.UtcNow.AddMinutes(-10),
            Expires = DateTime.UtcNow.AddMinutes(-5),
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(token);

        var validationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = ValidIssuer,
            ValidateAudience = true,
            ValidAudience = ValidAudience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = key,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };

        Assert.Throws<SecurityTokenExpiredException>(() =>
            tokenHandler.ValidateToken(tokenString, validationParameters, out _));
    }

    [Fact]
    public void InvalidSignature_FailsValidation()
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var validKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(ValidKey));
        var attackerKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("AttackerSecretKeyThatIsCompletelyDifferentFromOriginalKey123456789!"));

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Issuer = ValidIssuer,
            Audience = ValidAudience,
            Subject = new ClaimsIdentity(new[] { new Claim(ClaimTypes.Role, "ADMIN") }),
            Expires = DateTime.UtcNow.AddMinutes(30),
            SigningCredentials = new SigningCredentials(attackerKey, SecurityAlgorithms.HmacSha256)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(token);

        var validationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = ValidIssuer,
            ValidateAudience = true,
            ValidAudience = ValidAudience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = validKey,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };

        Assert.ThrowsAny<SecurityTokenException>(() =>
            tokenHandler.ValidateToken(tokenString, validationParameters, out _));
    }

    [Fact]
    public void WrongIssuer_FailsValidation()
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(ValidKey));

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Issuer = "Untrusted.Issuer",
            Audience = ValidAudience,
            Subject = new ClaimsIdentity(new[] { new Claim(ClaimTypes.Role, "STORE_OFFICER") }),
            Expires = DateTime.UtcNow.AddMinutes(30),
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(token);

        var validationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = ValidIssuer,
            ValidateAudience = true,
            ValidAudience = ValidAudience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = key,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };

        Assert.Throws<SecurityTokenInvalidIssuerException>(() =>
            tokenHandler.ValidateToken(tokenString, validationParameters, out _));
    }

    [Fact]
    public void WrongAudience_FailsValidation()
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(ValidKey));

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Issuer = ValidIssuer,
            Audience = "Wrong.Audience",
            Subject = new ClaimsIdentity(new[] { new Claim(ClaimTypes.Role, "STORE_OFFICER") }),
            Expires = DateTime.UtcNow.AddMinutes(30),
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(token);

        var validationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = ValidIssuer,
            ValidateAudience = true,
            ValidAudience = ValidAudience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = key,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };

        Assert.Throws<SecurityTokenInvalidAudienceException>(() =>
            tokenHandler.ValidateToken(tokenString, validationParameters, out _));
    }
}
