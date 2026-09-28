using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MediStock.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPurchaseOrderApprovalMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ApprovedById",
                table: "PurchaseOrders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectionReason",
                table: "PurchaseOrders",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RevisionReason",
                table: "PurchaseOrders",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ApprovedById",
                table: "PurchaseOrders");

            migrationBuilder.DropColumn(
                name: "RejectionReason",
                table: "PurchaseOrders");

            migrationBuilder.DropColumn(
                name: "RevisionReason",
                table: "PurchaseOrders");
        }
    }
}
