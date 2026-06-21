'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';

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

function DiagramGridSkeleton() {
    return (
        <li className={styles.GridItem}>
            <div className={styles.GridItemPreview}>
                <Skeleton width="80%" height={140} borderRadius={6} />
            </div>
            <div className={styles.GridItemInfo}>
                <Skeleton width="70%" height={14} />
                <Skeleton width={56} height={20} borderRadius={999} />
            </div>
            <div className={styles.CardActions}>
                <Skeleton width={80} height={28} borderRadius={6} />
                <Skeleton width={32} height={28} borderRadius={6} />
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
    const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
        if (typeof window !== 'undefined') return (localStorage.getItem('diagrams-view') as 'list' | 'grid') ?? 'list';
        return 'list';
    });

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
            <>
                <AppNavbar />
                <main className={styles.Page}>
                    <Alert severity="error">{loadError}</Alert>
                </main>
            </>
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
                        {viewMode === 'grid' ? (
                            <ul className={styles.GridList}>
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <DiagramGridSkeleton key={i} />
                                ))}
                            </ul>
                        ) : (
                            <ul className={styles.List}>
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <DiagramCardSkeleton key={i} />
                                ))}
                            </ul>
                        )}
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
                                    placeholder={t.diagrams.searchPlaceholder}
                                />
                            </div>
                            <select
                                className={styles.SortSelect}
                                value={sort}
                                onChange={(e) => setSort(e.target.value as SortKey)}
                            >
                                <option value="date-new">{t.diagrams.sortDateNew}</option>
                                <option value="date-old">{t.diagrams.sortDateOld}</option>
                                <option value="name-asc">{t.diagrams.sortNameAsc}</option>
                                <option value="name-desc">{t.diagrams.sortNameDesc}</option>
                            </select>
                            <select
                                className={styles.SortSelect}
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                            >
                                <option value="all">{t.diagrams.filterAllRoles}</option>
                                <option value="OWNER">{t.roles.OWNER}</option>
                                <option value="EDITOR">{t.roles.EDITOR}</option>
                                <option value="VIEWER">{t.roles.VIEWER}</option>
                            </select>
                            <button
                                type="button"
                                className={`${styles.ViewToggle} ${viewMode === 'list' ? styles.ViewToggle_active : ''}`}
                                title={t.diagrams.viewList}
                                onClick={() => { setViewMode('list'); localStorage.setItem('diagrams-view', 'list'); }}
                            >
                                <ViewListOutlinedIcon fontSize="small" />
                            </button>
                            <button
                                type="button"
                                className={`${styles.ViewToggle} ${viewMode === 'grid' ? styles.ViewToggle_active : ''}`}
                                title={t.diagrams.viewGrid}
                                onClick={() => { setViewMode('grid'); localStorage.setItem('diagrams-view', 'grid'); }}
                            >
                                <GridViewOutlinedIcon fontSize="small" />
                            </button>
                        </div>

                        {filtered.length === 0 ? (
                            <div className={styles.EmptyState}>
                                <Typography color="text.secondary">
                                    {t.diagrams.noResults}
                                </Typography>
                            </div>
                        ) : viewMode === 'grid' ? (
                            <ul className={styles.GridList}>
                                {filtered.map((diagram) => (
                                    <li key={diagram.id} className={styles.GridItem}>
                                        <Link href={`/diagrams/${diagram.id}`} className={styles.GridItemPreview} aria-label={diagram.name}>
                                            {diagram.preview ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={`data:image/svg+xml,${encodeURIComponent(diagram.preview)}`}
                                                    alt=""
                                                    className={styles.GridItemPreviewImg}
                                                />
                                            ) : (
                                                <span className={styles.GridItemIcon}>📊</span>
                                            )}
                                        </Link>
                                        <div className={styles.GridItemInfo}>
                                            <span className={styles.GridItemName} title={diagram.name}>{diagram.name}</span>
                                            <span className={styles.RoleBadge}>{roleLabel(diagram.role, t.roles)}</span>
                                        </div>
                                        <div className={styles.CardActions}>
                                            <Button component={Link} href={`/diagrams/${diagram.id}`} variant="contained" size="small">{t.common.diagram}</Button>
                                            <Button
                                                variant="outlined" size="small"
                                                loading={cloningId === diagram.id}
                                                disabled={cloningId !== null}
                                                title={t.diagrams.clone}
                                                onClick={() => void handleClone(diagram.id)}
                                            >
                                                <ContentCopyOutlinedIcon fontSize="small" />
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
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
                                                title={t.diagrams.clone}
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
