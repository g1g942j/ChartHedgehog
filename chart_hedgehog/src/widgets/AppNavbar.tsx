'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

import { fetchCurrentUser, logoutUser } from '@/features/profile/api/profile';
import { useLocale } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { Typography } from '@/shared/ui/Typography';

import styles from './AppNavbar.module.scss';

import { AppControls } from './AppControls';

function shortenName(name: string): string {
    return name.length <= 20 ? name : `${name.slice(0, 19)}...`;
}

export function AppNavbar() {
    const router = useRouter();
    const pathname = usePathname();
    const queryClient = useQueryClient();
    const { t } = useLocale();
    const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);

    const { data: user } = useQuery({
        queryKey: ['currentUser'],
        queryFn: fetchCurrentUser,
        retry: false,
    });

    const isMenuOpen = Boolean(menuAnchorEl);
    const displayName = shortenName(
        user?.fullName || user?.username || user?.email || t.profile.username,
    );
    const isDiagramsActive = pathname?.startsWith('/diagrams') ?? false;

    const closeMenu = () => {
        setMenuAnchorEl(null);
    };

    const handleLogout = async () => {
        await logoutUser();
        closeMenu();
        queryClient.removeQueries({ queryKey: ['currentUser'] });
        router.replace('/');
    };

    return (
        <header className={styles.Navbar}>
            <Link href="/diagrams" className={styles.Brand}>
                <span className={styles.BrandMark}>CH</span>
                <Typography component="span" variant="subtitle1">
                    ChartHedgehog
                </Typography>
            </Link>

            <nav className={styles.NavLinks} aria-label={t.diagrams.sectionsLabel}>
                <Button
                    component={Link}
                    href="/diagrams"
                    variant="text"
                    size="small"
                    className={[
                        styles.NavLink,
                        isDiagramsActive ? styles.NavLinkActive : '',
                    ]
                        .filter(Boolean)
                        .join(' ')}
                >
                    {t.common.diagrams}
                </Button>
            </nav>

            <div className={styles.RightSide}>
                <AppControls />
                <Button
                    variant="text"
                    size="small"
                    className={styles.UserButton}
                    endIcon={
                        isMenuOpen ? (
                            <KeyboardArrowUpIcon />
                        ) : (
                            <KeyboardArrowDownIcon />
                        )
                    }
                    onClick={(event) => setMenuAnchorEl(event.currentTarget)}
                >
                    {displayName}
                </Button>
                <Menu
                    anchorEl={menuAnchorEl}
                    open={isMenuOpen}
                    onClose={closeMenu}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    <MenuItem
                        onClick={() => {
                            closeMenu();
                            router.push('/profile');
                        }}
                    >
                        {t.common.profile}
                    </MenuItem>
                    <MenuItem onClick={() => void handleLogout()}>
                        {t.common.logout}
                    </MenuItem>
                </Menu>
            </div>
        </header>
    );
}
