/**
 * TaskForge — Advanced To-Do List Application
 * Fully modular, localStorage-persistent, feature-rich
 */

/* ============================================================
   STATE
   ============================================================ */
const State = {
  tasks: [],
  filter: 'all',          // all | pending | completed | high | medium | low
  sort: 'created',        // created | due | priority | name
  search: '',
  editingId: null,
  deletingId: null,

  load() {
    try {
      const saved = localStorage.getItem('taskforge_tasks');
      this.tasks = saved ? JSON.parse(saved) : [];
    } catch (e) {
      this.tasks = [];
    }
  },

  save() {
    localStorage.setItem('taskforge_tasks', JSON.stringify(this.tasks));
  }
};

/* ============================================================
   TASK MODEL
   ============================================================ */
const TaskModel = {
  /**
   * Create a new task object
   */
  create({ title, desc = '', priority = 'medium', due = '', tags = [] }) {
    return {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: title.trim(),
      desc: desc.trim(),
      priority,
      due,
      tags: tags.map(t => t.trim()).filter(Boolean),
      completed: false,
      createdAt: Date.now()
    };
  },

  add(data) {
    const task = this.create(data);
    State.tasks.unshift(task);
    State.save();
    return task;
  },

  update(id, data) {
    const idx = State.tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    State.tasks[idx] = { ...State.tasks[idx], ...data };
    State.save();
    return State.tasks[idx];
  },

  delete(id) {
    const idx = State.tasks.findIndex(t => t.id === id);
    if (idx === -1) return false;
    State.tasks.splice(idx, 1);
    State.save();
    return true;
  },

  toggle(id) {
    const task = State.tasks.find(t => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    State.save();
    return task;
  },

  getById(id) {
    return State.tasks.find(t => t.id === id) || null;
  },

  /**
   * Return filtered + searched + sorted tasks
   */
  getFiltered() {
    let list = [...State.tasks];

    // Priority filter
    const priorityFilters = ['high', 'medium', 'low'];
    if (priorityFilters.includes(State.filter)) {
      list = list.filter(t => t.priority === State.filter);
    } else if (State.filter === 'completed') {
      list = list.filter(t => t.completed);
    } else if (State.filter === 'pending') {
      list = list.filter(t => !t.completed);
    }

    // Search
    if (State.search.trim()) {
      const q = State.search.toLowerCase();
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }

    // Sort
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    list.sort((a, b) => {
      switch (State.sort) {
        case 'due':
          if (!a.due && !b.due) return 0;
          if (!a.due) return 1;
          if (!b.due) return -1;
          return new Date(a.due) - new Date(b.due);
        case 'priority':
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        case 'name':
          return a.title.localeCompare(b.title);
        case 'created':
        default:
          return b.createdAt - a.createdAt;
      }
    });

    return list;
  },

  /**
   * Statistics
   */
  getStats() {
    const total = State.tasks.length;
    const completed = State.tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const overdue = State.tasks.filter(t => {
      if (!t.due || t.completed) return false;
      return new Date(t.due) < today;
    }).length;
    return { total, completed, pending, overdue };
  }
};

/* ============================================================
   DATE UTILITIES
   ============================================================ */
const DateUtil = {
  today() {
    return new Date().toISOString().split('T')[0];
  },

  format(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  status(dateStr) {
    if (!dateStr) return 'none';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(dateStr + 'T00:00:00');
    const diff = Math.round((due - today) / 86400000);
    if (diff < 0) return 'overdue';
    if (diff <= 2) return 'due-soon';
    return 'ok';
  },

  label(dateStr) {
    if (!dateStr) return '';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(dateStr + 'T00:00:00');
    const diff = Math.round((due - today) / 86400000);
    if (diff < 0) return `Overdue ${Math.abs(diff)}d`;
    if (diff === 0) return 'Due Today';
    if (diff === 1) return 'Due Tomorrow';
    if (diff <= 7) return `Due in ${diff}d`;
    return `Due ${this.format(dateStr)}`;
  }
};

/* ============================================================
   RENDERER
   ============================================================ */
const Renderer = {
  taskList: document.getElementById('task-list'),
  emptyState: document.getElementById('empty-state'),

  /**
   * Render all tasks
   */
  renderTasks() {
    const tasks = TaskModel.getFiltered();
    this.taskList.innerHTML = '';

    if (tasks.length === 0) {
      this.emptyState.classList.add('visible');
    } else {
      this.emptyState.classList.remove('visible');
      tasks.forEach(task => {
        this.taskList.appendChild(this.buildTaskCard(task));
      });
    }

    this.renderStats();
    this.renderCounts();
  },

  /**
   * Build a task card DOM element
   */
  buildTaskCard(task) {
    const card = document.createElement('div');
    card.className = `task-card priority-${task.priority}${task.completed ? ' completed' : ''}`;
    card.dataset.id = task.id;

    // Checkbox
    const check = document.createElement('div');
    check.className = `task-check${task.completed ? ' checked' : ''}`;
    check.title = task.completed ? 'Mark as pending' : 'Mark as complete';

    // Body
    const body = document.createElement('div');
    body.className = 'task-body';

    const title = document.createElement('div');
    title.className = 'task-title';
    title.textContent = task.title;

    body.appendChild(title);

    if (task.desc) {
      const desc = document.createElement('div');
      desc.className = 'task-desc';
      desc.textContent = task.desc;
      body.appendChild(desc);
    }

    // Meta badges
    const meta = document.createElement('div');
    meta.className = 'task-meta';

    // Priority badge
    const pBadge = document.createElement('span');
    pBadge.className = `badge badge-priority-${task.priority}`;
    pBadge.textContent = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
    meta.appendChild(pBadge);

    // Due date badge
    if (task.due && !task.completed) {
      const dStatus = DateUtil.status(task.due);
      const dBadge = document.createElement('span');
      dBadge.className = `badge badge-due ${dStatus !== 'ok' ? dStatus : ''}`;
      dBadge.textContent = `📅 ${DateUtil.label(task.due)}`;
      meta.appendChild(dBadge);
    } else if (task.due && task.completed) {
      const dBadge = document.createElement('span');
      dBadge.className = 'badge badge-due';
      dBadge.textContent = `📅 ${DateUtil.format(task.due)}`;
      meta.appendChild(dBadge);
    }

    // Tags
    task.tags.forEach(tag => {
      const t = document.createElement('span');
      t.className = 'tag';
      t.textContent = `#${tag}`;
      meta.appendChild(t);
    });

    body.appendChild(meta);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn edit';
    editBtn.title = 'Edit task';
    editBtn.textContent = '✎';

    const delBtn = document.createElement('button');
    delBtn.className = 'action-btn del';
    delBtn.title = 'Delete task';
    delBtn.textContent = '✕';

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    card.appendChild(check);
    card.appendChild(body);
    card.appendChild(actions);

    // Events
    check.addEventListener('click', (e) => {
      e.stopPropagation();
      Controller.toggleTask(task.id);
    });

    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      Controller.openEditModal(task.id);
    });

    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      Controller.promptDelete(task.id);
    });

    return card;
  },

  /**
   * Render statistics panel
   */
  renderStats() {
    const s = TaskModel.getStats();
    document.getElementById('stat-total').textContent = s.total;
    document.getElementById('stat-done').textContent = s.completed;
    document.getElementById('stat-overdue').textContent = s.overdue;

    const pct = s.total === 0 ? 0 : Math.round((s.completed / s.total) * 100);
    document.getElementById('progress-bar').style.width = `${pct}%`;
    document.getElementById('progress-label').textContent = `${pct}% complete`;
  },

  /**
   * Render filter counts
   */
  renderCounts() {
    const total = State.tasks.length;
    const completed = State.tasks.filter(t => t.completed).length;
    const pending = total - completed;
    document.getElementById('count-all').textContent = total;
    document.getElementById('count-pending').textContent = pending;
    document.getElementById('count-completed').textContent = completed;
  },

  /**
   * Update section title based on active filter
   */
  updateSectionTitle() {
    const titles = {
      all: 'All Tasks',
      pending: 'Pending Tasks',
      completed: 'Completed Tasks',
      high: 'High Priority',
      medium: 'Medium Priority',
      low: 'Low Priority'
    };
    document.getElementById('section-title').textContent = titles[State.filter] || 'Tasks';
  }
};

/* ============================================================
   MODAL MANAGER
   ============================================================ */
const Modal = {
  overlay: document.getElementById('modal-overlay'),
  form: {
    title: document.getElementById('task-title'),
    desc: document.getElementById('task-desc'),
    priority: document.getElementById('task-priority'),
    due: document.getElementById('task-due'),
    tags: document.getElementById('task-tags'),
    charCount: document.getElementById('char-count'),
    modalTitle: document.getElementById('modal-title')
  },

  open(mode = 'add', task = null) {
    this.reset();
    if (mode === 'edit' && task) {
      this.form.modalTitle.textContent = 'Edit Task';
      this.form.title.value = task.title;
      this.form.desc.value = task.desc;
      this.form.priority.value = task.priority;
      this.form.due.value = task.due;
      this.form.tags.value = task.tags.join(', ');
      this.updateCharCount();
    } else {
      this.form.modalTitle.textContent = 'New Task';
    }
    this.overlay.classList.add('open');
    setTimeout(() => this.form.title.focus(), 150);
  },

  close() {
    this.overlay.classList.remove('open');
    this.reset();
  },

  reset() {
    this.form.title.value = '';
    this.form.desc.value = '';
    this.form.priority.value = 'medium';
    this.form.due.value = '';
    this.form.tags.value = '';
    this.updateCharCount();
  },

  updateCharCount() {
    const len = this.form.title.value.length;
    this.form.charCount.textContent = `${len}/120`;
  },

  getValues() {
    return {
      title: this.form.title.value.trim(),
      desc: this.form.desc.value.trim(),
      priority: this.form.priority.value,
      due: this.form.due.value,
      tags: this.form.tags.value.split(',').map(t => t.trim()).filter(Boolean)
    };
  },

  validate() {
    if (!this.form.title.value.trim()) {
      this.form.title.focus();
      this.form.title.style.borderColor = 'var(--high)';
      setTimeout(() => { this.form.title.style.borderColor = ''; }, 1500);
      return false;
    }
    return true;
  }
};

/* ============================================================
   CONFIRM DIALOG
   ============================================================ */
const ConfirmDialog = {
  overlay: document.getElementById('confirm-overlay'),

  open() {
    this.overlay.classList.add('open');
  },

  close() {
    this.overlay.classList.remove('open');
  }
};

/* ============================================================
   TOAST NOTIFICATION
   ============================================================ */
const Toast = {
  el: document.getElementById('toast'),
  timer: null,

  show(msg, type = 'info') {
    clearTimeout(this.timer);
    this.el.textContent = msg;
    this.el.className = `toast show ${type}`;
    this.timer = setTimeout(() => {
      this.el.classList.remove('show');
    }, 2800);
  }
};

/* ============================================================
   CONTROLLER
   ============================================================ */
const Controller = {
  init() {
    State.load();
    this.bindEvents();
    Renderer.renderTasks();
    Renderer.updateSectionTitle();
  },

  bindEvents() {
    // Filter nav
    document.querySelectorAll('.nav-btn[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        State.filter = btn.dataset.filter;
        Renderer.updateSectionTitle();
        Renderer.renderTasks();
      });
    });

    // Sort
    document.getElementById('sort-select').addEventListener('change', (e) => {
      State.sort = e.target.value;
      Renderer.renderTasks();
    });

    // Search
    const searchInput = document.getElementById('search-input');
    const clearSearch = document.getElementById('clear-search');

    searchInput.addEventListener('input', () => {
      State.search = searchInput.value;
      clearSearch.classList.toggle('visible', State.search.length > 0);
      Renderer.renderTasks();
    });

    clearSearch.addEventListener('click', () => {
      searchInput.value = '';
      State.search = '';
      clearSearch.classList.remove('visible');
      Renderer.renderTasks();
    });

    // Open add modal
    document.getElementById('open-modal-btn').addEventListener('click', () => {
      State.editingId = null;
      Modal.open('add');
    });

    // Modal close
    document.getElementById('modal-close').addEventListener('click', () => Modal.close());
    document.getElementById('modal-cancel').addEventListener('click', () => Modal.close());

    Modal.overlay.addEventListener('click', (e) => {
      if (e.target === Modal.overlay) Modal.close();
    });

    // Modal save
    document.getElementById('modal-save').addEventListener('click', () => this.saveTask());

    // Char count
    document.getElementById('task-title').addEventListener('input', () => Modal.updateCharCount());

    // Keyboard submit
    document.getElementById('task-title').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.saveTask();
    });

    // Confirm dialog
    document.getElementById('confirm-close').addEventListener('click', () => ConfirmDialog.close());
    document.getElementById('confirm-no').addEventListener('click', () => ConfirmDialog.close());
    document.getElementById('confirm-yes').addEventListener('click', () => this.confirmDelete());

    ConfirmDialog.overlay.addEventListener('click', (e) => {
      if (e.target === ConfirmDialog.overlay) ConfirmDialog.close();
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        Modal.close();
        ConfirmDialog.close();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('search-input').focus();
      }
    });
  },

  saveTask() {
    if (!Modal.validate()) return;
    const values = Modal.getValues();

    if (State.editingId) {
      TaskModel.update(State.editingId, values);
      Toast.show('Task updated ✓', 'success');
      State.editingId = null;
    } else {
      TaskModel.add(values);
      Toast.show('Task added ✓', 'success');
    }

    Modal.close();
    Renderer.renderTasks();
  },

  openEditModal(id) {
    const task = TaskModel.getById(id);
    if (!task) return;
    State.editingId = id;
    Modal.open('edit', task);
  },

  toggleTask(id) {
    const task = TaskModel.toggle(id);
    if (task) {
      Toast.show(task.completed ? 'Task completed ✓' : 'Task reopened', task.completed ? 'success' : 'info');
      Renderer.renderTasks();
    }
  },

  promptDelete(id) {
    State.deletingId = id;
    ConfirmDialog.open();
  },

  confirmDelete() {
    if (!State.deletingId) return;
    TaskModel.delete(State.deletingId);
    State.deletingId = null;
    ConfirmDialog.close();
    Toast.show('Task deleted', 'error');
    Renderer.renderTasks();
  }
};

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => Controller.init());
