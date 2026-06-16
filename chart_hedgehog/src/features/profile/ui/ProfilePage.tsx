'use client';

import { type FormEvent, useEffect,useState } from 'react';
import { useRouter } from 'next/navigation';

import { AppNavbar } from '@/widgets/AppNavbar';
import { useLocale } from '@/shared/i18n';
import { useToast } from '@/shared/toast';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { Skeleton } from '@/shared/ui/Skeleton';
import { TextField } from '@/shared/ui/TextField';
import { Typography } from '@/shared/ui/Typography';

import styles from './ProfilePage.module.scss';

import { useProfilePage } from '../model/useProfilePage';

export function ProfilePage() {
    const router = useRouter();
    const { t } = useLocale();
    const {
        userMeta,
        loadError,
        isLoadingProfile,
        updateProfile,
        updateProfileError,
        isUpdatingProfile,
        resetUpdateProfile,
        changePassword,
        changePasswordError,
        isChangingPassword,
        resetChangePassword,
        deactivateAccount,
        deactivateAccountError,
        isDeactivatingAccount,
    } = useProfilePage();
    const [emailDraft, setEmailDraft] = useState<string | null>(null);
    const [fullNameDraft, setFullNameDraft] = useState<string | null>(null);
    const email = emailDraft ?? userMeta?.email ?? '';
    const fullName = fullNameDraft ?? userMeta?.fullName ?? '';
    const setEmail = (v: string) => setEmailDraft(v);
    const setFullName = (v: string) => setFullNameDraft(v);

    const toast = useToast();
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordValidationError, setPasswordValidationError] = useState<
        string | null
    >(null);

    useEffect(() => {
        if (!isLoadingProfile && loadError) {
            router.replace('/');
        }
    }, [isLoadingProfile, loadError, router]);

    const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        resetUpdateProfile();

        try {
            await updateProfile({ email, fullName });
            setEmailDraft(null);
            setFullNameDraft(null);
            toast.success(t.profile.profileSaved);
        } catch {
            // Ошибка уже доступна через состояние mutation.
        }
    };

    const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        resetChangePassword();
        setPasswordValidationError(null);

        if (newPassword !== confirmPassword) {
            setPasswordValidationError(t.profile.passwordsMismatch);
            return;
        }

        try {
            await changePassword({ oldPassword, newPassword });
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
            toast.success(t.profile.passwordChanged);
        } catch {
            // Ошибка уже доступна через состояние mutation.
        }
    };

    const handleDeactivate = async () => {
        if (!window.confirm(t.profile.deleteConfirm)) {
            return;
        }

        try {
            await deactivateAccount();
            router.replace('/');
        } catch {
            // Ошибка уже доступна через состояние mutation.
        }
    };

    if (isLoadingProfile) {
        return (
            <>
                <AppNavbar />
                <main className={styles.Page}>
                    <Skeleton width={200} height={32} />
                    <div className={styles.ProfileGrid}>
                        <div className={styles.Card} style={{ gap: 16 }}>
                            <Skeleton width={140} height={20} />
                            <Skeleton height={40} borderRadius={8} />
                            <Skeleton height={40} borderRadius={8} />
                            <Skeleton height={40} borderRadius={8} />
                        </div>
                        <div className={styles.Card} style={{ gap: 16 }}>
                            <Skeleton width={160} height={20} />
                            <Skeleton height={40} borderRadius={8} />
                            <Skeleton height={40} borderRadius={8} />
                            <Skeleton height={40} borderRadius={8} />
                        </div>
                    </div>
                </main>
            </>
        );
    }

    if (!userMeta) {
        return null;
    }

    return (
        <>
            <AppNavbar />
            <main className={styles.Page}>
                <div className={styles.HeaderRow}>
                    <Typography variant="h4" component="h1">
                        {t.profile.title}
                    </Typography>
                </div>

                <div className={styles.ProfileGrid}>
                    <form className={styles.Card} onSubmit={handleProfileSubmit}>
                        <Typography variant="subtitle1">
                            {t.profile.accountData}
                        </Typography>
                        {updateProfileError ? (
                            <Alert severity="error">{updateProfileError}</Alert>
                        ) : null}
                        <TextField
                            label={t.profile.username}
                            value={userMeta.username}
                            disabled
                        />
                        <TextField
                            label={t.profile.email}
                            value={email}
                            type="email"
                            autoComplete="email"
                            disabled={isUpdatingProfile || isDeactivatingAccount}
                            onChange={setEmail}
                        />
                        <TextField
                            label={t.profile.fullName}
                            value={fullName}
                            autoComplete="name"
                            disabled={isUpdatingProfile || isDeactivatingAccount}
                            onChange={setFullName}
                        />
                        <div className={styles.Actions}>
                            <Button
                                type="submit"
                                variant="contained"
                                loading={isUpdatingProfile}
                                disabled={
                                    isDeactivatingAccount ||
                                    (email.trim() === userMeta.email &&
                                        fullName.trim() ===
                                            (userMeta.fullName ?? ''))
                                }
                            >
                                {t.profile.saveProfile}
                            </Button>
                        </div>
                    </form>

                    <form className={styles.Card} onSubmit={handlePasswordSubmit}>
                        <Typography variant="subtitle1">
                            {t.profile.passwordTitle}
                        </Typography>
                        {passwordValidationError || changePasswordError ? (
                            <Alert severity="error">
                                {passwordValidationError ?? changePasswordError}
                            </Alert>
                        ) : null}
                        <TextField
                            label={t.profile.oldPassword}
                            value={oldPassword}
                            type="password"
                            autoComplete="current-password"
                            disabled={isChangingPassword || isDeactivatingAccount}
                            onChange={setOldPassword}
                        />
                        <TextField
                            label={t.profile.newPassword}
                            value={newPassword}
                            type="password"
                            autoComplete="new-password"
                            disabled={isChangingPassword || isDeactivatingAccount}
                            onChange={setNewPassword}
                        />
                        <TextField
                            label={t.profile.confirmPassword}
                            value={confirmPassword}
                            type="password"
                            autoComplete="new-password"
                            disabled={isChangingPassword || isDeactivatingAccount}
                            onChange={setConfirmPassword}
                        />
                        <div className={styles.Actions}>
                            <Button
                                type="submit"
                                variant="contained"
                                loading={isChangingPassword}
                                disabled={
                                    isDeactivatingAccount ||
                                    !oldPassword ||
                                    !newPassword ||
                                    !confirmPassword
                                }
                            >
                                {t.profile.changePassword}
                            </Button>
                        </div>
                    </form>
                </div>

                <section className={`${styles.Card} ${styles.DangerCard}`}>
                    <Typography variant="subtitle1">
                        {t.profile.dangerZone}
                    </Typography>
                    <Typography color="text.secondary">
                        {t.profile.deleteDescription}
                    </Typography>
                    {deactivateAccountError ? (
                        <Alert severity="error">{deactivateAccountError}</Alert>
                    ) : null}
                    <div className={styles.Actions}>
                        <Button
                            type="button"
                            variant="outlined"
                            color="error"
                            loading={isDeactivatingAccount}
                            disabled={isUpdatingProfile || isChangingPassword}
                            onClick={() => void handleDeactivate()}
                        >
                            {t.profile.deleteAccount}
                        </Button>
                    </div>
                </section>
            </main>
        </>
    );
}
