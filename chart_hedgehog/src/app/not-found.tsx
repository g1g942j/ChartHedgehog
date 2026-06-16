import Link from 'next/link';

import styles from './not-found.module.scss';

export default function NotFound() {
    return (
        <div className={styles.Page}>
            <div className={styles.Code}>404</div>
            <div className={styles.Title}>Страница не найдена</div>
            <div className={styles.Sub}>
                Похоже, эта страница была удалена или никогда не существовала.
            </div>
            <Link href="/diagrams" className={styles.Btn}>
                ← Вернуться к диаграммам
            </Link>
        </div>
    );
}
