import logging
from typing import Any, Dict, List, Optional
import httpx
from ..config import settings

logger = logging.getLogger(__name__)


class BackendClient:
    """HTTP client communicating with the authoritative ASP.NET Core backend."""

    def __init__(self, base_url: Optional[str] = None, token: Optional[str] = None):
        self.base_url = (base_url or settings.BACKEND_URL).rstrip("/")
        self.token = token or settings.INTERNAL_TOKEN

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["X-Internal-Token"] = self.token
        return headers

    def _candidate_urls(self) -> List[str]:
        urls = [self.base_url]
        for fallback in ("http://backend:5050", "http://localhost:5050"):
            if fallback not in urls:
                urls.append(fallback)
        return urls

    async def _get_async(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Any:
        last_exc = None
        for base in self._candidate_urls():
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(
                        f"{base}{endpoint}",
                        params=params,
                        headers=self._headers(),
                    )
                    resp.raise_for_status()
                    self.base_url = base
                    data = resp.json()
                    return data.get("data", []) if isinstance(data, dict) and "data" in data else data
            except (httpx.ConnectError, httpx.TimeoutException) as exc:
                last_exc = exc
                continue
        if last_exc:
            raise last_exc
        return None

    def _get_sync(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Any:
        last_exc = None
        for base in self._candidate_urls():
            try:
                with httpx.Client(timeout=10.0) as client:
                    resp = client.get(
                        f"{base}{endpoint}",
                        params=params,
                        headers=self._headers(),
                    )
                    resp.raise_for_status()
                    self.base_url = base
                    data = resp.json()
                    return data.get("data", []) if isinstance(data, dict) and "data" in data else data
            except (httpx.ConnectError, httpx.TimeoutException) as exc:
                last_exc = exc
                continue
        if last_exc:
            raise last_exc
        return None

    async def get_inventory(
        self,
        facility_id: Optional[str] = None,
        include_archived: bool = False,
    ) -> List[Dict[str, Any]]:
        """Fetch REAL inventory from backend asynchronously."""
        params: Dict[str, Any] = {"includeArchived": str(include_archived).lower()}
        if facility_id:
            params["facilityId"] = str(facility_id)
        result = await self._get_async("/api/inventory", params=params)
        return result if isinstance(result, list) else []

    def get_inventory_sync(
        self,
        facility_id: Optional[str] = None,
        include_archived: bool = False,
    ) -> List[Dict[str, Any]]:
        """Fetch REAL inventory from backend synchronously."""
        params: Dict[str, Any] = {"includeArchived": str(include_archived).lower()}
        if facility_id:
            params["facilityId"] = str(facility_id)
        result = self._get_sync("/api/inventory", params=params)
        return result if isinstance(result, list) else []

    async def get_transfer(self, transfer_id: str) -> Dict[str, Any]:
        """Fetch transfer details from backend asynchronously."""
        result = await self._get_async(f"/api/transfers/{transfer_id}")
        return result if isinstance(result, dict) else {}

    def get_transfer_sync(self, transfer_id: str) -> Dict[str, Any]:
        """Fetch transfer details from backend synchronously."""
        result = self._get_sync(f"/api/transfers/{transfer_id}")
        return result if isinstance(result, dict) else {}

    async def get_facilities(self) -> List[Dict[str, Any]]:
        """Fetch all active facilities from backend asynchronously."""
        result = await self._get_async("/api/facilities")
        return result if isinstance(result, list) else []

    def get_facilities_sync(self) -> List[Dict[str, Any]]:
        """Fetch all active facilities from backend synchronously."""
        result = self._get_sync("/api/facilities")
        return result if isinstance(result, list) else []

    async def get_transfer_candidates(self, transfer_id: str) -> List[Dict[str, Any]]:
        """Fetch candidate facilities for transfer from backend asynchronously."""
        result = await self._get_async(f"/api/transfers/{transfer_id}/candidates")
        return result if isinstance(result, list) else []

    def get_transfer_candidates_sync(self, transfer_id: str) -> List[Dict[str, Any]]:
        """Fetch candidate facilities for transfer from backend synchronously."""
        result = self._get_sync(f"/api/transfers/{transfer_id}/candidates")
        return result if isinstance(result, list) else []

    async def get_route(self, source_facility_id: str, destination_facility_id: str) -> Dict[str, Any]:
        """Fetch route calculation between two facilities from authoritative backend asynchronously."""
        params = {"sourceFacilityId": str(source_facility_id), "destinationFacilityId": str(destination_facility_id)}
        result = await self._get_async("/api/transfers/route-preview", params=params)
        return result if isinstance(result, dict) else {}

    def get_route_sync(self, source_facility_id: str, destination_facility_id: str) -> Dict[str, Any]:
        """Fetch route calculation between two facilities from authoritative backend synchronously."""
        params = {"sourceFacilityId": str(source_facility_id), "destinationFacilityId": str(destination_facility_id)}
        result = self._get_sync("/api/transfers/route-preview", params=params)
        return result if isinstance(result, dict) else {}

