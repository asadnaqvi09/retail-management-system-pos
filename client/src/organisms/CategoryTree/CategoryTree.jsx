import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, FolderTree, Pencil, Trash2 } from 'lucide-react';
import Badge from '../../atoms/Badge';
import Button from '../../atoms/Button';

function CategoryTreeNode({ node, depth, canManage, onEdit, onDeactivate }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children?.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-[#fafafa]"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted hover:bg-[#f4f4f8]"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="inline-block h-6 w-6 shrink-0" />
        )}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <FolderTree size={15} className="shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium">{node.name}</div>
            {node.description ? (
              <div className="truncate text-[12px] text-muted">{node.description}</div>
            ) : null}
          </div>
          {!node.isActive ? (
            <Badge variant="warning">{t('categories.status.inactive')}</Badge>
          ) : null}
          <span className="text-[12px] tabular-nums text-muted">
            {t('categories.productCount', { count: node.productCount })}
          </span>
        </div>
        {canManage ? (
          <div className="flex shrink-0 gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(node)}>
              <Pencil size={14} />
            </Button>
            {node.isActive ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => onDeactivate(node)}>
                <Trash2 size={14} />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {hasChildren && expanded
        ? node.children.map((child) => (
            <CategoryTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              canManage={canManage}
              onEdit={onEdit}
              onDeactivate={onDeactivate}
            />
          ))
        : null}
    </div>
  );
}

export default function CategoryTree({ categories, isLoading, canManage, onEdit, onDeactivate }) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (!categories.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef2ff] text-primary">
          <FolderTree size={22} strokeWidth={1.75} />
        </div>
        <p className="text-[14px] font-medium">{t('categories.emptyTitle')}</p>
        <p className="mt-1 max-w-sm text-[13px] text-muted">{t('categories.emptySubtitle')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      {categories.map((node) => (
        <CategoryTreeNode
          key={node.id}
          node={node}
          depth={0}
          canManage={canManage}
          onEdit={onEdit}
          onDeactivate={onDeactivate}
        />
      ))}
    </div>
  );
}
