import React from 'react';
import { useResponsiveContext } from './ResponsiveLayout';

interface ColumnConfig<T = unknown> {
  key: string;
  header: string;
  render?: (value: unknown, item: T) => React.ReactNode;
  className?: string;
}

interface TableCardSwitcherProps<T = unknown> {
  data: T[];
  columns: ColumnConfig<T>[];
  actions?: {
    label: string;
    onClick: (item: T) => void;
    icon?: React.ComponentType<{ className?: string }>;
    variant?: 'primary' | 'secondary' | 'danger';
  }[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
}

export const TableCardSwitcher = <T,>({
  data,
  columns,
  actions,
  keyExtractor,
  emptyMessage = 'Nenhum item encontrado'
}: TableCardSwitcherProps<T>) => {
  const { isMobile } = useResponsiveContext();

  if (isMobile) {
    return (
      <div className="space-y-4">
        {data.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {emptyMessage}
          </div>
        ) : (
          data.map((item) => (
            <div
              key={keyExtractor(item)}
              className="relative z-40 rounded-lg shadow-sm border border-border overflow-hidden bg-card text-card-foreground"
            >
              {/* Card Header */}
              <div className="px-4 py-3 bg-muted border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {columns[0] && (
                      <div className="text-sm font-medium text-foreground">
                        {columns[0].render 
                          ? columns[0].render(item[columns[0].key], item)
                          : item[columns[0].key]
                        }
                      </div>
                    )}
                  </div>
                  {actions && actions.length > 0 && (
                    <div className="flex space-x-2">
                      {actions.map((action, index) => {
                        const Icon = action.icon;
                        return (
                          <button
                            key={index}
                            onClick={() => action.onClick(item)}
                            className={`p-2 rounded-md text-sm font-medium transition-colors touch-button ${
                              action.variant === 'danger'
                                ? 'text-red-600 hover:bg-red-50'
                              : action.variant === 'primary'
                                ? 'text-blue-600 hover:bg-muted/50'
                                : 'text-muted-foreground hover:bg-muted/50'
                            }`}
                            aria-label={action.label}
                          >
                            {Icon && <Icon className="h-4 w-4" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="px-4 py-3 space-y-2">
                {columns.slice(1).map((column) => (
                  <div key={column.key} className="flex justify-between items-start">
                    <span className="text-sm font-medium text-muted-foreground">
                      {column.header}:
                    </span>
                    <span className="text-sm text-foreground text-right max-w-[60%]">
                      {column.render 
                        ? column.render(item[column.key], item)
                        : item[column.key]
                      }
                    </span>
                  </div>
                ))}
              </div>

              {/* Card Footer - Actions if not in header */}
              {actions && actions.length > 0 && (
                <div className="px-4 py-3 bg-muted border-t border-border flex justify-end space-x-2">
                  {actions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => action.onClick(item)}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors touch-button ${
                        action.variant === 'danger'
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : action.variant === 'primary'
                          ? 'bg-muted text-blue-600 hover:bg-muted/50'
                          : 'bg-muted text-foreground hover:bg-muted/50'
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    );
  }

  // Desktop Table View
  return (
    <div className="relative z-40 rounded-lg shadow-sm border border-border overflow-hidden bg-card text-card-foreground">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-xs table-fixed">
          <thead className="bg-muted text-xs">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-3 py-2 text-left font-medium text-muted-foreground uppercase tracking-wider ${
                    column.className || ''
                  }`}
                >
                  {column.header}
                </th>
              ))}
              {actions && actions.length > 0 && (
                <th className="px-3 py-2 text-right font-medium text-muted-foreground uppercase tracking-wider">
                  Ações
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-6 py-8 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr key={keyExtractor(item)} className="hover:bg-muted">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-3 py-2 whitespace-nowrap text-xs text-foreground ${
                        column.className || ''
                      }`}
                    >
                      {column.render 
                        ? column.render(item[column.key], item)
                        : item[column.key]
                      }
                    </td>
                  ))}
                  {actions && actions.length > 0 && (
                    <td className="px-3 py-2 whitespace-nowrap text-right text-xs font-medium">
                      <div className="flex justify-end space-x-2">
                        {actions.map((action, index) => (
                          <button
                            key={index}
                            onClick={() => action.onClick(item)}
                            className={`text-xs font-medium transition-colors ${
                              action.variant === 'danger'
                                ? 'text-red-600 hover:text-red-900'
                              : action.variant === 'primary'
                                ? 'text-blue-600 hover:text-blue-900'
                              : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TableCardSwitcher;
