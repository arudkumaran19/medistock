from typing import Any
import os
import httpx

class BackendUnavailableError(RuntimeError):
	"""Raised when the controlled MediStock API cannot be reached."""

class InventoryBackend:
	"""Controlled API adapter; the agent never connects to the database."""
	def __init__(self, base_url: str | None = None) -> None:
		self.base_url = (base_url or os.getenv("MEDISTOCK_API_BASE_URL", "http://localhost:5000")).rstrip("/")
		self.timeout = httpx.Timeout(5.0)
	async def get_inventory(self) -> list[dict[str, Any]]:
		try:
			async with httpx.AsyncClient(timeout=self.timeout) as client:
				response = await client.get(f"{self.base_url}/api/inventory"); response.raise_for_status(); return response.json().get("data", [])
		except httpx.RequestError as error:
			raise BackendUnavailableError("MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL to its address.") from error
	async def get_expiring(self, days: int = 90) -> list[dict[str, Any]]:
		try:
			async with httpx.AsyncClient(timeout=self.timeout) as client:
				response = await client.get(f"{self.base_url}/api/inventory/expiring", params={"days": days}); response.raise_for_status(); return response.json().get("data", [])
		except httpx.RequestError as error:
			raise BackendUnavailableError("MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL to its address.") from error
	async def get_medicines(self) -> list[dict[str, Any]]:
		try:
			async with httpx.AsyncClient(timeout=self.timeout) as client:
				response = await client.get(f"{self.base_url}/api/medicines"); response.raise_for_status(); return response.json().get("data", [])
		except httpx.RequestError as error:
			raise BackendUnavailableError("MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL to its address.") from error
	async def get_facilities(self) -> list[dict[str, Any]]:
		try:
			async with httpx.AsyncClient(timeout=self.timeout) as client:
				response = await client.get(f"{self.base_url}/api/facilities"); response.raise_for_status(); return response.json().get("data", [])
		except httpx.RequestError as error:
			raise BackendUnavailableError("MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL to its address.") from error
	async def get_batches(self) -> list[dict[str, Any]]:
		try:
			async with httpx.AsyncClient(timeout=self.timeout) as client:
				response = await client.get(f"{self.base_url}/api/medicine-batches"); response.raise_for_status(); return response.json().get("data", [])
		except httpx.RequestError as error:
			raise BackendUnavailableError("MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL to its address.") from error
	async def get_batch(self, batch_number: str) -> dict[str, Any] | None:
		try:
			async with httpx.AsyncClient(timeout=self.timeout) as client:
				response = await client.get(f"{self.base_url}/api/medicine-batches/lookup", params={"batchNumber": batch_number})
				if response.status_code == 404: return None
				response.raise_for_status(); return response.json().get("data")
		except httpx.RequestError as error:
			raise BackendUnavailableError("MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL to its address.") from error
	async def get_transactions(self, medicine_id: str, facility_id: str) -> list[dict[str, Any]]:
		try:
			async with httpx.AsyncClient(timeout=self.timeout) as client:
				response = await client.get(f"{self.base_url}/api/inventory/transactions", params={"medicineId": medicine_id, "facilityId": facility_id})
				response.raise_for_status(); return response.json().get("data", [])
		except httpx.RequestError as error:
			raise BackendUnavailableError("MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL to its address.") from error
	async def execute(self, action: str, payload: dict[str, Any]) -> dict[str, Any]:
		paths = {"receive": "/api/inventory/receive", "adjust": "/api/inventory/adjust", "reserve": "/api/inventory/reserve"}
		if action not in paths: raise ValueError("Only controlled inventory mutations are executable")
		try:
			async with httpx.AsyncClient(timeout=self.timeout) as client:
				response = await client.post(f"{self.base_url}{paths[action]}", json=payload); response.raise_for_status(); return response.json().get("data", response.json())
		except httpx.RequestError as error:
			raise BackendUnavailableError("MediStock backend is unavailable. Start the ASP.NET API or set MEDISTOCK_API_BASE_URL to its address.") from error
