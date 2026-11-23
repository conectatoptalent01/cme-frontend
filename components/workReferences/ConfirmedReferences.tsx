"use client";

import React, { useEffect, useState } from "react";
import { backend } from "../../lib/backend";
import styles from "./workReferences.module.css";

type Ref = { id: string; reference_name: string; company_name: string; relationship: string; reference_comment: string | null; resolved_at: string | null };

/**
 * Referencias laborales confirmadas del candidato. Solo se muestran a la empresa que lo está evaluando
 * (el backend responde 403 a cualquier otra persona y entonces no se muestra nada).
 */
export default function ConfirmedReferences({ candidateId, sectionClassName }: { candidateId: string; sectionClassName?: string }) {
  const [items, setItems] = useState<Ref[] | null>(null);
  useEffect(() => {
    backend<Ref[]>(`work-references/candidate/${encodeURIComponent(candidateId)}`).then(setItems).catch(() => setItems(null));
  }, [candidateId]);

  if (!items || items.length === 0) return null;
  return (
    <div className={sectionClassName}>
      <h3>Referencias laborales confirmadas</h3>
      <ul className={styles.list}>
        {items.map((r) => (
          <li key={r.id} className={styles.item}>
            <div>
              <div className={styles.name}>{r.reference_name}</div>
              <div className={styles.muted}>{r.relationship} · {r.company_name}</div>
              {r.reference_comment && <p className={styles.comment}>“{r.reference_comment}”</p>}
            </div>
            <div className={styles.side}>
              <span className={`${styles.pill} ${styles.ok}`}>Confirmada por WhatsApp</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
