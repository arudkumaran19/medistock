using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MediStock.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FixDeliveryPurchaseOrderRelationship : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Deliveries_PurchaseOrders_PurchaseOrderId1",
                table: "Deliveries");

            migrationBuilder.DropIndex(
                name: "IX_Deliveries_PurchaseOrderId1",
                table: "Deliveries");

            migrationBuilder.DropColumn(
                name: "PurchaseOrderId1",
                table: "Deliveries");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PurchaseOrderId1",
                table: "Deliveries",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Deliveries_PurchaseOrderId1",
                table: "Deliveries",
                column: "PurchaseOrderId1");

            migrationBuilder.AddForeignKey(
                name: "FK_Deliveries_PurchaseOrders_PurchaseOrderId1",
                table: "Deliveries",
                column: "PurchaseOrderId1",
                principalTable: "PurchaseOrders",
                principalColumn: "Id");
        }
    }
}
