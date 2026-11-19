"use client";

import { useState } from "react";
import type { Filters } from "../../hooks/useJobSearch";
import styles from "./filters.module.css";
import Image from "next/image";
import SearchIcon from "../../public/images/icons/search.png";
import FilterIcon from "../../public/images/icons/Filter.png";
import Clearicon from "../../public/images/icons/Clear.png";

type Props = {
  defaultValues: Filters;
  onSubmit: (filters: Filters) => void;
};

export default function FiltersBar({ defaultValues, onSubmit }: Props) {
  const [q, setQ] = useState(defaultValues.q);
  const [projectType, setProjectType] = useState(defaultValues.projectType);
  const [paymentType, setPaymentType] = useState(defaultValues.paymentType);
  const [minSalary, setMinSalary] = useState<number | "">(defaultValues.minSalary);
  const [maxSalary, setMaxSalary] = useState<number | "">(defaultValues.maxSalary);
  const [location, setLocation] = useState(defaultValues.location);
  const [orderBy, setOrderBy] = useState(defaultValues.orderBy);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ q, projectType, paymentType, minSalary, maxSalary, location, orderBy });
  };

  return (
    <form onSubmit={handleSubmit} className={styles.filtersForm}>
      <div className={styles.searchInput}>
        <Image src={SearchIcon} alt="Search" className={styles.searchIcon} width={16} height={16} />
        <input
          type="text"
          placeholder="Buscar Ofertas..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={styles.searchField}
        />
      </div>

      <select value={projectType} onChange={(e) => setProjectType(e.target.value)}>
        <option value="">Tipo de proyecto</option>
        <option value="full-time">Tiempo completo</option>
        <option value="part-time">Tiempo parcial</option>
        <option value="services-agreement">Contrato de servicios</option>
        <option value="one-off">Trabajo puntual</option>
        <option value="consulting">Consultoría</option>
      </select>

      <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
        <option value="">Metodo de pago</option>
        <option value="salary">Salario</option>
        <option value="hourly">Por hora</option>
        <option value="per-project">Por proyecto</option>
      </select>

      <input
        type="number"
        className={styles.numberSearchField}
        placeholder="Min..."
        value={minSalary}
        onChange={(e) => setMinSalary(e.target.value === "" ? "" : Number(e.target.value))}
      />
      <input
        type="number"
        className={styles.numberSearchField}
        placeholder="Max..."
        value={maxSalary}
        onChange={(e) => setMaxSalary(e.target.value === "" ? "" : Number(e.target.value))}
      />
      <input type="text" className={styles.numberSearchField} placeholder="Ubicación" value={location} onChange={(e) => setLocation(e.target.value)} />

      <select value={orderBy} onChange={(e) => setOrderBy(e.target.value as Filters["orderBy"])}>
        <option value="newest">Nuevos</option>
        <option value="oldest">Antiguos</option>
        <option value="salary_desc">Salario ↑</option>
        <option value="salary_asc">Salario ↓</option>
      </select>
      <button className={styles.submitButton} type="submit">
        <Image src={FilterIcon} alt="Filter" className={styles.sumbitIcon} width={20} height={16} />
      </button>
      <button
        type="button"
        className={styles.clearButton}
        onClick={() => {
          setQ("");
          setProjectType("");
          setPaymentType("");
          setMinSalary("");
          setMaxSalary("");
          setLocation("");
          setOrderBy("newest");
          onSubmit({
            q: "",
            projectType: "",
            paymentType: "",
            minSalary: "",
            maxSalary: "",
            location: "",
            orderBy: "newest",
          });
        }}
      >
        <Image src={Clearicon} alt="Clear" className={styles.sumbitIcon} width={20} height={16} />
      </button>
    </form>
  );
}
