'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';

import { AppNavbar } from '@/widgets/AppNavbar';
import { useLocale } from '@/shared/i18n';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { Skeleton } from '@/shared/ui/Skeleton';
import { TextField } from '@/shared/ui/TextField';
import { Typography } from '@/shared/ui/Typography';

import styles from './DiagramsPage.module.scss';

import { roleLabel } from '../constants/roles';
import { useDiagramsList } from '../model/useDiagramsList';

type SortKey = 'name-asc' | 'name-desc' | 'date-new' | 'date-old';
type RoleFilter = 'all' | 'OWNER' | 'EDITOR' | 'VIEWER';

function DiagramCardSkeleton() {
    return (
        <li className={styles.Item}>
            <div className={styles.ItemMain}>
                <Skeleton width="60%" height={20} />
                <Skeleton width={60} height={22} borderRadius={999} />
            </div>
            <Skeleton width="40%" height={14} />
            <div className={styles.CardActions}>
                <Skeleton width={80} height={30} borderRadius={6} />
                <Skeleton width={100} height={30} borderRadius={6} />
            </div>
        </li>
    );
}

export function DiagramsPage() {
    const { t } = useLocale();
    const {
        diagrams,
        isLoading,
        loadError,
        newName,
        setNewName,
        isCreating,
        handleCreate,
        cloningId,
        handleClone,
    } = useDiagramsList();

    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<SortKey>('date-new');
    const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

    const filtered = useMemo(() => {
        let result = diagrams;

        if (search.trim()) {
            const q = search.trim().toLowerCase();
            result = result.filter((d) => d.name.toLowerCase().includes(q));
        }

        if (roleFilter !== 'all') {
            result = result.filter((d) => d.role === roleFilter);
        }

        return [...result].sort((a, b) => {
            if (sort === 'name-asc') return a.name.localeCompare(b.name);
            if (sort === 'name-desc') return b.name.localeCompare(a.name);
            const dateA = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
            const dateB = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
            return sort === 'date-new' ? dateB - dateA : dateA - dateB;
        });
    }, [diagrams, search, sort, roleFilter]);

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

                {isLoading ? (
                    <section>
                        <ul className={styles.List}>
                            {Array.from({ length: 4 }).map((_, i) => (
                                <DiagramCardSkeleton key={i} />
                            ))}
                        </ul>
                    </section>
                ) : diagrams.length === 0 ? (
                    <div className={styles.EmptyState}>
                        <Typography color="text.secondary">
                            {t.diagrams.empty}
                        </Typography>
                    </div>
                ) : (
                    <section>
                        <div className={styles.Controls}>
                            <div className={styles.SearchWrap}>
                                <TextField
                                    label=""
                                    value={search}
                                    onChange={setSearch}
                                    placeholder="Поиск по названию…"
                                />
                            </div>
                            <select
                                className={styles.SortSelect}
                                value={sort}
                                onChange={(e) => setSort(e.target.value as SortKey)}
                            >
                                <option value="date-new">Сначала новые</option>
                                <option value="date-old">Сначала старые</option>
                                <option value="name-asc">По имени А→Я</option>
                                <option value="name-desc">По имени Я→А</option>
                            </select>
                            <select
                                className={styles.SortSelect}
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                            >
                                <option value="all">Все роли</option>
                                <option value="OWNER">Владелец</option>
                                <option value="EDITOR">Редактор</option>
                                <option value="VIEWER">Зритель</option>
                            </select>
                        </div>

                        {filtered.length === 0 ? (
                            <div className={styles.EmptyState}>
                                <Typography color="text.secondary">
                                    Ничего не найдено
                                </Typography>
                            </div>
                        ) : (
                            <ul className={styles.List}>
                                {filtered.map((diagram) => (
                                    <li key={diagram.id} className={styles.Item}>
                                        <div className={styles.ItemMain}>
                                            <Typography variant="subtitle1" component="span">
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
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                loading={cloningId === diagram.id}
                                                disabled={cloningId !== null}
                                                title="Клонировать диаграмму"
                                                onClick={() => void handleClone(diagram.id)}
                                            >
                                                <ContentCopyOutlinedIcon fontSize="small" />
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                )}
            </main>
        </>
    );
}
