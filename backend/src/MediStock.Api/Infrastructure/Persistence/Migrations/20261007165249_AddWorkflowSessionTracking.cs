using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MediStock.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkflowSessionTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MessageId",
                table: "WorkflowRuns",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SessionId",
                table: "WorkflowRuns",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MessageId",
                table: "WorkflowRuns");

            migrationBuilder.DropColumn(
                name: "SessionId",
                table: "WorkflowRuns");
        }
    }
}
