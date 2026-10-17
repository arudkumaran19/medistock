using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MediStock.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSystemAuditLogsAndShortageHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PurchaseOrderId",
                table: "ShortageAlerts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ResolutionVerified",
                table: "ShortageAlerts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "TransferId",
                table: "ShortageAlerts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VerificationMethod",
                table: "ShortageAlerts",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VerificationNotes",
                table: "ShortageAlerts",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VerifiedBy",
                table: "ShortageAlerts",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ShortageStatusHistories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ShortageAlertId = table.Column<Guid>(type: "uuid", nullable: false),
                    FromStatus = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ToStatus = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ChangedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ChangedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    VerificationMethod = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShortageStatusHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ShortageStatusHistories_ShortageAlerts_ShortageAlertId",
                        column: x => x.ShortageAlertId,
                        principalTable: "ShortageAlerts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SystemAuditLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CorrelationId = table.Column<string>(type: "text", nullable: true),
                    ActorId = table.Column<string>(type: "text", nullable: true),
                    ActorEmail = table.Column<string>(type: "text", nullable: true),
                    ActorRole = table.Column<string>(type: "text", nullable: true),
                    Action = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ResourceType = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    ResourceId = table.Column<string>(type: "text", nullable: true),
                    Outcome = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: true),
                    DetailsJson = table.Column<string>(type: "text", nullable: true),
                    BeforeStateJson = table.Column<string>(type: "text", nullable: true),
                    AfterStateJson = table.Column<string>(type: "text", nullable: true),
                    IpAddress = table.Column<string>(type: "text", nullable: true),
                    Timestamp = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SystemAuditLogs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ShortageStatusHistories_ChangedAt",
                table: "ShortageStatusHistories",
                column: "ChangedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ShortageStatusHistories_ShortageAlertId",
                table: "ShortageStatusHistories",
                column: "ShortageAlertId");

            migrationBuilder.CreateIndex(
                name: "IX_SystemAuditLogs_Action",
                table: "SystemAuditLogs",
                column: "Action");

            migrationBuilder.CreateIndex(
                name: "IX_SystemAuditLogs_ActorEmail",
                table: "SystemAuditLogs",
                column: "ActorEmail");

            migrationBuilder.CreateIndex(
                name: "IX_SystemAuditLogs_CorrelationId",
                table: "SystemAuditLogs",
                column: "CorrelationId");

            migrationBuilder.CreateIndex(
                name: "IX_SystemAuditLogs_ResourceType",
                table: "SystemAuditLogs",
                column: "ResourceType");

            migrationBuilder.CreateIndex(
                name: "IX_SystemAuditLogs_Timestamp",
                table: "SystemAuditLogs",
                column: "Timestamp");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ShortageStatusHistories");

            migrationBuilder.DropTable(
                name: "SystemAuditLogs");

            migrationBuilder.DropColumn(
                name: "PurchaseOrderId",
                table: "ShortageAlerts");

            migrationBuilder.DropColumn(
                name: "ResolutionVerified",
                table: "ShortageAlerts");

            migrationBuilder.DropColumn(
                name: "TransferId",
                table: "ShortageAlerts");

            migrationBuilder.DropColumn(
                name: "VerificationMethod",
                table: "ShortageAlerts");

            migrationBuilder.DropColumn(
                name: "VerificationNotes",
                table: "ShortageAlerts");

            migrationBuilder.DropColumn(
                name: "VerifiedBy",
                table: "ShortageAlerts");
        }
    }
}
