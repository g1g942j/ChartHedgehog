'use client';

import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

import { useLocale } from '@/shared/i18n';

import { Button } from '../Button';

type ConfirmModalProps = {
    open: boolean;
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    dangerous?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

export function ConfirmModal({
    open,
    title,
    message,
    confirmLabel,
    cancelLabel,
    dangerous = false,
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    const { t } = useLocale();

    return (
        <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
            {title ? <DialogTitle>{title}</DialogTitle> : null}
            <DialogContent>
                <DialogContentText>{message}</DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" onClick={onCancel}>
                    {cancelLabel ?? t.common.cancel}
                </Button>
                <Button
                    variant="contained"
                    color={dangerous ? 'error' : 'primary'}
                    onClick={onConfirm}
                    data-testid="confirm-modal-ok"
                >
                    {confirmLabel ?? t.common.confirm}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
