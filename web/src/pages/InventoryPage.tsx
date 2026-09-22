import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { inventoryApi } from "../services/inventoryApi";
import type { Inventory } from "../types/inventory";
import { InventoryAgentPanel } from "../components/InventoryAgentPanel";

export function InventoryPage() {
  const [items, setItems] = useState<Inventory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    inventoryApi
      .list()
      .then(setItems)
      .catch((e: Error) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">MEDISTOCK / INVENTORY</p>
          <h1>Facility stock control</h1>
        </div>

        <nav>
          <Link to="/inventory/receive">Receive stock</Link>
          <Link to="/inventory/expiry">Expiry watch</Link>
        </nav>
      </header>

      <section className="summary">
        <strong>{items.length}</strong>
        <span>tracked balances</span>

        <strong>
          {items.filter((x) => x.isBelowMinimum).length}
        </strong>
        <span>below minimum</span>
      </section>

      <InventoryAgentPanel />

      {isLoading && <p>Loading inventory...</p>}

      {error && <p className="error">{error}</p>}

      {!isLoading && !error && !items.length && (
        <p>No inventory balances have been recorded.</p>
      )}

      {!isLoading && !error && !!items.length && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Facility</th>
                <th>On hand</th>
                <th>Available</th>
                <th>Minimum</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link to={`/inventory/${item.id}`}>
                      {item.medicineName}
                    </Link>
                  </td>

                  <td>{item.facilityName}</td>
                  <td>{item.quantityOnHand}</td>
                  <td>{item.availableQuantity}</td>
                  <td>{item.minimumStockLevel}</td>

                  <td>
                    <span
                      className={
                        item.isBelowMinimum
                          ? "status danger"
                          : "status"
                      }
                    >
                      {item.isBelowMinimum
                        ? "Below minimum"
                        : "Healthy"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}