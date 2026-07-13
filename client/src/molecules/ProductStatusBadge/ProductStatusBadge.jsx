import { useTranslation } from 'react-i18next';
import Badge from '../../atoms/Badge';

const statusVariants = {
  active: 'success',
  inactive: 'default',
  draft: 'warning',
};

export default function ProductStatusBadge({ status }) {
  const { t } = useTranslation();
  return (
    <Badge variant={statusVariants[status] || 'default'}>
      {t(`products.status.${status}`, status)}
    </Badge>
  );
}
