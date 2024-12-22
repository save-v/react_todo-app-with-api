/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React, {
  useEffect,
  useRef,
  useState,
  Dispatch,
  SetStateAction,
  FormEvent,
  useMemo,
} from 'react';
import { USER_ID } from './api/todos';
import { Todo } from './types/Todo';
import { client } from './utils/fetchClient';
import cN from 'classnames';
import { TodoItem } from './components/TodoItem';
import { Filter } from './types/Filter';
import { Error } from './types/Error';
import { ErrorNotification } from './components/ErrorNotification';
import { filterTodosByStatus } from './utils/filterTodosByStatus';
import { removeTodoById } from './utils/removeTodoById';

const filterValues = Object.values(Filter);

export const App: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [errorMessage, setErrorMessage] = useState<Error>(Error.Default);
  const [activeFilter, setActiveFilter] = useState<Filter>(Filter.All);
  const [tempTodo, setTempTodo] = useState<Todo | null>(null);
  const [todoToDeleteIds, setTodoToDeleteIds] = useState<number[]>([]);

  const [inputText, setInputText] = useState('');
  const [statusChangeId, setStatusChangeId] = useState<number[]>([]);

  const addTodoField = useRef<HTMLInputElement>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAllCompleted = useMemo(() => {
    return !todos.some(todo => todo.completed === false);
  }, [todos]);

  const hasCompleted = useMemo(() => {
    return todos.some(todo => todo.completed === true);
  }, [todos]);

  const activeCount: number = useMemo(() => {
    return todos.reduce((acc, todo) => {
      if (todo.completed === false) {
        return acc + 1;
      }

      return acc;
    }, 0);
  }, [todos]);

  function trimTitle(text: string) {
    return text.replace(/\s+/g, ' ').trim();
  }

  function showError(message: Error) {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }

    setErrorMessage(message);
    errorTimeoutRef.current = setTimeout(
      () => setErrorMessage(Error.Default),
      3000,
    );
  }

  function filterToBool(filter: Filter) {
    let boolFilter = null;

    if (filter === Filter.Active) {
      boolFilter = false;
    } else if (filter === Filter.Completed) {
      boolFilter = true;
    }

    return boolFilter;
  }

  function changeState(
    id: number,
    todosState: Dispatch<SetStateAction<Todo[]>>,
    updatedTodo: Todo,
  ) {
    todosState(prev => {
      const changed = prev.map(todo => (todo.id === id ? updatedTodo : todo));

      return changed;
    });
  }

  function handleTitleChange(newTitle: string, editingTodoId: number | null) {
    const updateStatus = { title: newTitle };

    return client
      .patch<Todo>(`/todos/${editingTodoId}`, updateStatus)
      .then(fetchedTodo => {
        changeState(editingTodoId as number, setTodos, fetchedTodo);
      })
      .catch(error => {
        showError(Error.UpdateError);
        throw error;
      });
  }

  function handleTodoStatusChange(id: number, newStatus: boolean) {
    setStatusChangeId(prev => [...prev, id]);
    const updateStatus = { completed: newStatus };

    return client
      .patch<Todo>(`/todos/${id}`, updateStatus)
      .then(fetchedTodo => {
        changeState(id, setTodos, fetchedTodo);
      })
      .catch(() => showError(Error.UpdateError))
      .finally(() => {
        setStatusChangeId(prev => prev.filter(idParametr => idParametr !== id));
      });
  }

  function setFocusOnAddInput() {
    if (addTodoField.current !== null) {
      addTodoField.current.focus();
    }
  }

  useEffect(() => {
    client
      .get<Todo[]>(`/todos?userId=${USER_ID}`)
      .then(fetchedTodos => {
        setTodos(fetchedTodos);
        setFocusOnAddInput();
      })
      .catch(() => showError(Error.LoadError));
  }, []);

  useEffect(() => {
    if (!tempTodo) {
      /*tempTodo === null для того, не виконувати це два рази (бо стейт tempTodo спочатку змінюється на об'єкт а потім змінюється на null)*/
      setFocusOnAddInput();
    }
  }, [tempTodo]);

  function handleAddTodoOnEnter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = trimTitle(inputText);

    if (!title.length) {
      showError(Error.EmptyTitleError);
    } else {
      const newTodo = {
        id: 0,
        title: title,
        userId: USER_ID,
        completed: false,
      };

      setTempTodo(newTodo);

      client
        .post<Todo>(`/todos`, newTodo)
        .then(fetchedTodo => {
          setInputText('');
          setTodos(prevTodos => [...prevTodos, fetchedTodo]);
        })
        .catch(() => showError(Error.AddError))
        .finally(() => {
          setTempTodo(null);
        });
    }
  }

  function onDelete(id: number): Promise<void> {
    return client
      .delete(`/todos/${id}`)
      .then(() => {
        setTodos(prevTodos => removeTodoById(prevTodos, id));
      })
      .catch(() => showError(Error.DeleteError));
  }

  function handleClearCompleted() {
    const completedTodoIds = todos.reduce(
      (acc, todo) => (todo.completed ? [...acc, todo.id] : acc),
      [] as number[],
    );

    setTodoToDeleteIds(completedTodoIds);

    const promises: Promise<void>[] = [];

    completedTodoIds.forEach(id => {
      promises.push(onDelete(id));
    });

    Promise.all(promises).then(() => {
      setFocusOnAddInput();
    });
  }

  function changeStatusAll() {
    const status = isAllCompleted ? false : true;

    todos.forEach(todo => {
      if (todo.completed !== status) {
        handleTodoStatusChange(todo.id, status);
      }
    });
  }

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <header className="todoapp__header">
          {/* this button should have `active` class only if all todos are completed +++*/}
          {todos.length !== 0 && (
            <button
              type="button"
              className={cN('todoapp__toggle-all', { active: isAllCompleted })}
              data-cy="ToggleAllButton"
              onClick={changeStatusAll}
            />
          )}

          {/* Add a todo on form submit +*/}
          <form onSubmit={handleAddTodoOnEnter}>
            <input
              ref={addTodoField}
              data-cy="NewTodoField"
              type="text"
              value={inputText}
              className="todoapp__new-todo"
              placeholder="What needs to be done?"
              onChange={event => setInputText(event.target.value)}
              disabled={!!tempTodo}
            />
          </form>
        </header>

        <section className="todoapp__main" data-cy="TodoList">
          {filterTodosByStatus(todos, filterToBool(activeFilter)).map(todo => (
            <TodoItem
              key={todo.id}
              todo={todo}
              handleTodoStatusChange={handleTodoStatusChange}
              onDelete={onDelete}
              todoToDeleteIds={todoToDeleteIds}
              setTodoToDeleteIds={setTodoToDeleteIds}
              addTodoField={addTodoField}
              statusChangeId={statusChangeId}
              handleTitleChange={handleTitleChange}
            />
          ))}

          {!!tempTodo && (
            <TodoItem key={tempTodo.id} todo={tempTodo} isTemp={true} />
          )}
        </section>

        {/* Hide the footer if there are no todos +++*/}
        {todos.length !== 0 && (
          <footer className="todoapp__footer" data-cy="Footer">
            <span className="todo-count" data-cy="TodosCounter">
              {activeCount} items left
            </span>

            {/* Active link should have the 'selected' class +++*/}
            <nav className="filter" data-cy="Filter">
              {filterValues.map(filter => {
                return (
                  <a
                    key={filter}
                    href={`#/${filter === 'All' ? '' : filter}`}
                    className={cN('filter__link', {
                      selected: activeFilter === filter,
                    })}
                    data-cy={`FilterLink${filter}`}
                    onClick={() => setActiveFilter(filter)}
                  >
                    {filter}
                  </a>
                );
              })}
            </nav>
            {/* this button should be disabled if there are no completed todos +++*/}
            <button
              type="button"
              className="todoapp__clear-completed"
              data-cy="ClearCompletedButton"
              disabled={!hasCompleted}
              onClick={handleClearCompleted}
            >
              Clear completed
            </button>
          </footer>
        )}
      </div>

      {/* DON'T use conditional rendering to hide the notification +++*/}
      {/* Add the 'hidden' class to hide the message smoothly +++*/}
      <ErrorNotification
        errorMessage={errorMessage}
        setErrorMessage={setErrorMessage}
      />
    </div>
  );
};
