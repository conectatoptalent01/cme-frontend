'use client';

import React, { useState } from 'react';
import styles from './settings.module.css';
import UpdateProfile from './profile/UpdateProfile';
import WorkReferences from '../../../components/workReferences/WorkReferences';

type Props = {};

export default function Client({ }: Props) {
    // ?tab=referencias abre directamente la sección de referencias laborales
    const [active, setActive] = useState<number>(() =>
        typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'referencias' ? 2 : 1);

    return (
        <div className={styles.main}>
            <div className={styles.card}>
                <aside className={styles.settingNav}>
                    <h2 className={styles.navTitle}>Ajustes</h2>

                    <div className={styles.options}>
                        <div className={styles.optionSection}>
                            <p className={styles.sectionLabel}>Perfil</p>

                            <button
                                onClick={() => setActive(1)}
                                className={`${styles.option} ${active === 1 ? styles.optionActive : ''}`}
                            >
                                Editar mi perfil
                            </button>

                            <button
                                onClick={() => setActive(2)}
                                className={`${styles.option} ${active === 2 ? styles.optionActive : ''}`}
                            >
                                Referencias laborales
                            </button>
                        </div>
                    </div>
                </aside>

                <section className={styles.activeOption}>
                    <div className={styles.contentWrap}>
                        {active === 1 && <UpdateProfile />}

                        {active === 2 && <WorkReferences />}
                    </div>
                </section>
            </div>
        </div>
    );
}
