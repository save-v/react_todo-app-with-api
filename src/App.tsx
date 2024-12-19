/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React, {
  useEffect,
  useRef,
  useState,
  Dispatch,
  SetStateAction,
  FormEvent,
} from 'react';
import { USER_ID } from './api/todos';
import { Todo } from './types/Todo';
import { client } from './utils/fetchClient';
import cN from 'classnames';
import { TodoItem } from './components/TodoItem';
import { Filter } from './types/Filter';
import { Error } from './types/Error';
import { ErrorNotification } from './components/ErrorNotification';

function filterTodosByStatus(
  todos: Todo[],
  completedStatus: boolean | null = null,
) {
  if (completedStatus === null) {
    return todos;
  }

  return todos.filter(todo => todo.completed === completedStatus);
}

function removeTodoById(todos: Todo[], id: number) {
  return todos.filter(todo => todo.id !== id);
}

export const App: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [errorMessage, setErrorMessage] = useState<Error | null>(null);
  const [activeFilter, setActiveFilter] = useState<Filter>(Filter.All);
  const [tempTodo, setTempTodo] = useState<Todo | null>(null);
  const [todoToDeleteIds, setTodoToDeleteIds] = useState<number[] | null>(null);

  const [inputText, setInputText] = useState<string>('');
  const [isDeletingTodo, setIsDeletingTodo] = useState<boolean>(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [filteredTodos, setFilteredTodos] = useState<Todo[]>([]);
  const [statusChangeId, setStatusChangeId] = useState<number[]>([]);
  const [editingTodoId, setEditingTodoId] = useState<number | null>(null);
  const [isUpdatingTitle, setIsUpdatingTitle] = useState<boolean>(false);

  const addTodoField = useRef<HTMLInputElement>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAllCompleted = !todos.some(todo => todo.completed === false);
  const hasCompleted = todos.some(todo => todo.completed === true);

  const activeCount: number = todos.reduce((acc, todo) => {
    if (todo.completed === false) {
      return acc + 1;
    }

    return acc;
  }, 0);
  const filterValues = Object.values(Filter);

  function trimTitle(text: string) {
    return text.replace(/\s+/g, ' ').trim();
  }

  function ShowError(message: Error) {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }

    setErrorMessage(message);
    errorTimeoutRef.current = setTimeout(() => setErrorMessage(null), 3000);
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
    const filter = filterToBool(activeFilter);

    todosState(prev => {
      let changed = prev.map(todo => (todo.id === id ? updatedTodo : todo));

      if (todosState === setFilteredTodos) {
        changed = filterTodosByStatus(changed, filter);
      }

      return changed;
    });
  }

  function handleTitleChange(newTitle: string, currentTitle: string) {
    const trimedTitle = trimTitle(newTitle);

    if (trimedTitle === currentTitle) {
      setEditingTodoId(null);

      return;
    }

    const updateStatus = { title: trimedTitle };

    setIsUpdatingTitle(true);

    return client
      .patch<Todo>(`/todos/${editingTodoId}`, updateStatus)
      .then(fetchedTodo => {
        changeState(editingTodoId as number, setFilteredTodos, fetchedTodo);
        changeState(editingTodoId as number, setTodos, fetchedTodo);
        setEditingTodoId(null);
      })
      .catch(error => {
        ShowError(Error.UpdateError);
        throw error;
      })
      .finally(() => {
        setIsUpdatingTitle(false);
      });
  }

  function handleTodoStatusChange(id: number, newStatus: boolean) {
    setStatusChangeId(prev => [...prev, id]);
    const updateStatus = { completed: newStatus };

    setIsUpdatingStatus(true);

    return client
      .patch<Todo>(`/todos/${id}`, updateStatus)
      .then(fetchedTodo => {
        changeState(id, setFilteredTodos, fetchedTodo);
        changeState(id, setTodos, fetchedTodo);
      })
      .catch(() => ShowError(Error.UpdateError))
      .finally(() => {
        setStatusChangeId(prev => prev.filter(idParametr => idParametr !== id));
        setIsUpdatingStatus(false);
      });
  }

  useEffect(() => {
    client
      .get<Todo[]>(`/todos?userId=${USER_ID}`)
      .then(fetchedTodos => {
        setTodos(fetchedTodos);
        setFilteredTodos(fetchedTodos);
        if (addTodoField.current !== null) {
          addTodoField.current.focus();
        }
      })
      .catch(() => ShowError(Error.LoadError));
  }, []);

  useEffect(() => {
    if (addTodoField.current !== null && tempTodo === null) {
      /*tempTodo === null для того, не виконувати це два рази (бо стейт tempTodo спочатку змінюється на об'єкт а потім змінюється на null)*/
      addTodoField.current.focus();
    }
  }, [tempTodo]);

  function handleAddTodoOnEnter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = trimTitle(inputText);

    if (title === '') {
      ShowError(Error.EmptyTitleError);
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
          setFilteredTodos(prevTodos => [...prevTodos, fetchedTodo]);
        })
        .catch(() => ShowError(Error.AddError))
        .finally(() => {
          setTempTodo(null);
        });
    }
  }

  function onDelete(id: number): Promise<void> {
    setIsDeletingTodo(true);

    return client
      .delete(`/todos/${id}`)
      .then(() => {
        setTodos(prevTodos => removeTodoById(prevTodos, id));
        setFilteredTodos(prevTodos => removeTodoById(prevTodos, id));
      })
      .catch(() => ShowError(Error.DeleteError))
      .finally(() => {
        setIsDeletingTodo(false);
      });
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
      //винести
      if (addTodoField.current !== null) {
        addTodoField.current.focus();
      }
    });
  }

  function handleFilter(filterParam: Filter) {
    const filter = filterToBool(filterParam);

    setFilteredTodos(filterTodosByStatus(todos, filter));
    setActiveFilter(filterParam);
  }

  useEffect(() => {
    handleFilter(activeFilter); //&&&
  });

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
              disabled={tempTodo !== null}
            />
          </form>
        </header>
        <section className="todoapp__main" data-cy="TodoList">
          {filteredTodos.map(todo => (
            <TodoItem
              key={todo.id}
              todo={todo}
              handleTodoStatusChange={handleTodoStatusChange}
              onDelete={onDelete}
              isDeletingTodo={isDeletingTodo}
              todoToDeleteIds={todoToDeleteIds}
              setTodoToDeleteIds={setTodoToDeleteIds}
              addTodoField={addTodoField}
              isUpdatingStatus={isUpdatingStatus}
              statusChangeId={statusChangeId}
              setEditingTodoId={setEditingTodoId}
              editingTodoId={editingTodoId}
              handleTitleChange={handleTitleChange}
              isUpdatingTitle={isUpdatingTitle}
            />
          ))}
          {tempTodo !== null && (
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
                    onClick={() => handleFilter(filter)}
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
