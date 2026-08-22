"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (value: string) => {
    if (value.length < 4 || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: value }),
      });
      if (response.ok) {
        router.replace(searchParams.get("next") || "/");
        router.refresh();
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Fel PIN-kod.");
        setPin("");
      }
    } catch {
      setError("Kunde inte kontakta servern. Kontrollera din uppkoppling.");
    }
    setLoading(false);
  };

  const press = (digit: string) => {
    if (pin.length >= 4 || loading) return;
    const next = pin + digit;
    setPin(next);
    setError("");
    if (next.length === 4) submit(next);
  };
  const backspace = () => { if (!loading) { setPin(pin.slice(0, -1)); setError(""); } };

  return (
    <main className="pinShell">
      <div className="pinCard">
        <div className="brandMark">R</div>
        <h1>ROUND</h1>
        <p>Ange PIN-koden för att fortsätta</p>
        <div className={`pinDots ${error ? "pinError" : ""}`}>
          {Array.from({ length: 4 }).map((_, i) => <span key={i} className={i < pin.length ? "filled" : ""} />)}
        </div>
        {error && <p className="pinErrorText">{error}</p>}
        <div className="pinPad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key, i) => key === "" ? <span key={i} /> : (
            <button key={i} disabled={loading} onClick={() => key === "⌫" ? backspace() : press(key)}>{key}</button>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function PinPage() {
  return (
    <Suspense fallback={null}>
      <PinForm />
    </Suspense>
  );
}
