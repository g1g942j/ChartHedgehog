'use client';

import Link from 'next/link';

import { AppNavbar } from '@/widgets/AppNavbar';
import { useLocale } from '@/shared/i18n';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/TextField';
import { Typography } from '@/shared/ui/Typography';

import styles from './DiagramsPage.module.scss';

import { roleLabel } from '../constants/roles';
import { useDiagramsList } from '../model/useDiagramsList';


export function DiagramsPage() {
    const { t } = useLocale();
    const {
        diagrams,
        isLoading,
        loadError,
        newName,
        setNewName,
        isCreating,
        createError,
        handleCreate,
    } = useDiagramsList();

    if (isLoading) {
        return (
            <main className={styles.Page}>
                <Typography>{t.common.loading}</Typography>
            </main>
        );
    }

    if (loadError && loadError !== 'Не авторизован') {
        return (
            <main className={styles.Page}>
                <Alert severity="error">{loadError}</Alert>
            </main>
        );
    }

    return (
        <>
            <AppNavbar />
            <main className={styles.Page}>
                <div className={styles.HeaderRow}>
                    <Typography variant="h4" component="h1">
                        {t.diagrams.title}
                    </Typography>
                </div>

                <section className={styles.Card}>
                    <Typography variant="subtitle1">
                        {t.diagrams.newDiagram}
                    </Typography>
                    {createError ? (
                        <Alert severity="error">{createError}</Alert>
                    ) : null}
                    <div className={styles.CreateRow}>
                        <TextField
                            label={t.diagrams.nameLabel}
                            value={newName}
                            onChange={setNewName}
                            placeholder={t.diagrams.namePlaceholder}
                        />
                        <Button
                            variant="contained"
                            loading={isCreating}
                            onClick={() => void handleCreate()}
                        >
                            {t.diagrams.create}
                        </Button>
                    </div>
                </section>

                {diagrams.length === 0 ? (
                    <div className={styles.EmptyState}>
                        <Typography color="text.secondary">
                            {t.diagrams.empty}
                        </Typography>
                    </div>
                ) : (
                <section>
                        <ul className={styles.List}>
                            {diagrams.map((diagram) => {
                                return (
                                    <li key={diagram.id} className={styles.Item}>
                                        <div className={styles.ItemMain}>
                                            <Typography
                                                variant="subtitle1"
                                                component="span"
                                            >
                                                {diagram.name}
                                            </Typography>
                                            <span className={styles.RoleBadge}>
                                                {roleLabel(diagram.role, t.roles)}
                                            </span>
                                        </div>
                                        {diagram.description ? (
                                            <Typography variant="body2">
                                                {diagram.description}
                                            </Typography>
                                        ) : null}
                                        <div className={styles.CardActions}>
                                            <Button
                                                component={Link}
                                                href={`/diagrams/${diagram.id}`}
                                                variant="contained"
                                                size="small"
                                            >
                                                {t.common.diagram}
                                            </Button>
                                            <Button
                                                component={Link}
                                                href={`/diagrams/${diagram.id}/participants`}
                                                variant="outlined"
                                                size="small"
                                            >
                                                {t.common.participants}
                                            </Button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                </section>
                )}
            </main>
        </>
    );
}
