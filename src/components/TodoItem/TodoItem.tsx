/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React, {
  Dispatch,
  SetStateAction,
  RefObject,
  useState,
  useRef,
  useEffect,
} from 'react';
import { Todo } from '../../types/Todo';
import cN from 'classnames';

type Props = {
  todo: Todo;
  isTemp?: boolean;
  handleTodoStatusChange?: (id: number) => void;
  onDelete?: (id: number) => Promise<void>;
  isDeletingTodo?: boolean;
  todoToDeleteIds?: number[] | null;
  setTodoToDeleteIds?: Dispatch<SetStateAction<number[] | null>>;
  addTodoField?: RefObject<HTMLInputElement>;
  isUpdatingStatus?: boolean;
  statusChangeId?: number | null;
  setEditingTodoId?: Dispatch<SetStateAction<number | null>>;
  editingTodoId?: number | null;
  handleTitleChange?: (newTitle: string) => void;
  isUpdatingTitle?: boolean | null;
};

export const TodoItem: React.FC<Props> = ({
  todo,
  isTemp = false,
  handleTodoStatusChange,
  onDelete,
  isDeletingTodo,
  todoToDeleteIds,
  setTodoToDeleteIds,
  addTodoField,
  isUpdatingStatus,
  statusChangeId,
  setEditingTodoId,
  editingTodoId,
  handleTitleChange,
  isUpdatingTitle,
}) => {
  const { title, id, completed } = todo;
  const [inputValue, setInputValue] = useState<string>(title);
  const editTodoField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editTodoField.current !== null) {
      editTodoField.current.focus();
    }
  }, [editingTodoId]);

  return (
    <div key={id} data-cy="Todo" className={cN('todo', { completed })}>
      <label className="todo__status-label">
        <input
          data-cy="TodoStatus"
          type="checkbox"
          className="todo__status"
          checked={completed}
          onChange={() => (isTemp ? null : handleTodoStatusChange?.(id))}
        />
      </label>
      {id === editingTodoId ? (
        <form onSubmit={() => handleTitleChange?.(inputValue)}>
          <input
            onBlur={() => {
              handleTitleChange?.(inputValue);
            }}
            ref={editTodoField}
            data-cy="TodoTitleField"
            type="text"
            className="todo__title-field"
            placeholder="Empty todo will be deleted"
            value={inputValue}
            onChange={event => setInputValue(event.target.value)}
          />
        </form>
      ) : (
        <>
          <span
            onDoubleClick={() => setEditingTodoId?.(id)}
            data-cy="TodoTitle"
            className="todo__title"
          >
            {title}
          </span>
          <button
            onClick={() => {
              setTodoToDeleteIds?.([id]);
              onDelete?.(id).then(() => {
                if (addTodoField?.current !== null) {
                  addTodoField?.current.focus();
                }
              });
            }}
            type="button"
            className="todo__remove"
            data-cy="TodoDelete"
          >
            ×
          </button>
        </>
      )}
      {/* isDeletingTodo спробувати прибрати*/}
      <div
        data-cy="TodoLoader"
        className={cN('modal overlay', {
          'is-active':
            isTemp ||
            (isDeletingTodo && todoToDeleteIds?.includes(id)) ||
            (isUpdatingStatus && id === statusChangeId) ||
            (isUpdatingTitle && id === editingTodoId),
        })}
      >
        <div className="modal-background has-background-white-ter" />
        <div className="loader" />
      </div>
    </div>
  );
};
