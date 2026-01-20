const dataUrl = "data.csv";

const state = {
  raw: [],
  columns: [],
  numericColumns: [],
  categoricalColumns: [],
  sort: { column: null, direction: 1 },
  filter: { column: "", value: "" },
  charts: {
    histogram: null,
    category: null,
    scatter: null,
  },
};

const elements = {
  csvInput: document.getElementById("csv-input"),
  parseButton: document.getElementById("parse-csv"),
  clearButton: document.getElementById("clear-csv"),
  loadData: document.getElementById("load-data"),
  fileInput: document.getElementById("csv-file"),
  rowCount: document.getElementById("row-count"),
  columnCount: document.getElementById("column-count"),
  missingCount: document.getElementById("missing-count"),
  missingTable: document.getElementById("missing-table"),
  numericSummary: document.getElementById("numeric-summary"),
  filterColumn: document.getElementById("filter-column"),
  filterValue: document.getElementById("filter-value"),
  clearFilter: document.getElementById("clear-filter"),
  dataTable: document.getElementById("data-table"),
  dataStatus: document.getElementById("data-status"),
  histogramColumn: document.getElementById("histogram-column"),
  categoryColumn: document.getElementById("category-column"),
  scatterX: document.getElementById("scatter-x"),
  scatterY: document.getElementById("scatter-y"),
};

const parseCsv = (csvText) => {
  const result = Papa.parse(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (result.errors.length) {
    alert(`CSV parse error: ${result.errors[0].message}`);
    return;
  }

  state.raw = result.data;
  state.columns = result.meta.fields || [];
  state.sort = { column: null, direction: 1 };
  state.filter = { column: "", value: "" };
  updateColumnTypes();
  refreshUI();
  updateStatus(`Loaded ${state.raw.length} rows from CSV.`);
};

const updateStatus = (message, isError = false) => {
  if (!elements.dataStatus) {
    return;
  }
  elements.dataStatus.textContent = message;
  elements.dataStatus.classList.toggle("text-red-600", isError);
  elements.dataStatus.classList.toggle("font-semibold", isError);
  elements.dataStatus.classList.toggle("text-slate-500", !isError);
};

const loadDataFile = async () => {
  updateStatus("Loading data.csv…");
  try {
    const response = await fetch(dataUrl);
    if (!response.ok) {
      throw new Error(`Failed to load ${dataUrl} (${response.status})`);
    }
    const csvText = await response.text();
    parseCsv(csvText);
  } catch (error) {
    updateStatus(`Could not load data.csv. ${error.message}`, true);
  }
};

const updateColumnTypes = () => {
  const numericColumns = [];
  const categoricalColumns = [];

  state.columns.forEach((column) => {
    const values = state.raw
      .map((row) => row[column])
      .filter((value) => value !== null && value !== undefined && String(value).trim() !== "");
    const numericCount = values.filter((value) => !Number.isNaN(Number(value))).length;
    if (values.length && numericCount / values.length >= 0.7) {
      numericColumns.push(column);
    } else {
      categoricalColumns.push(column);
    }
  });

  state.numericColumns = numericColumns;
  state.categoricalColumns = categoricalColumns;
};

const refreshUI = () => {
  updateSummary();
  renderMissingTable();
  renderNumericSummary();
  renderFilterControls();
  renderTable();
  renderCharts();
};

const updateSummary = () => {
  elements.rowCount.textContent = state.raw.length;
  elements.columnCount.textContent = state.columns.length;
  const missing = state.columns.reduce((sum, column) => sum + countMissing(column), 0);
  elements.missingCount.textContent = missing;
};

const countMissing = (column) =>
  state.raw.filter((row) => row[column] === null || row[column] === undefined || String(row[column]).trim() === "").length;

const renderMissingTable = () => {
  if (!state.columns.length) {
    elements.missingTable.innerHTML = "<p class=\"helper\">Load data to see missing values.</p>";
    return;
  }

  const rows = state.columns
    .map((column) => ({ column, missing: countMissing(column) }))
    .sort((a, b) => b.missing - a.missing);

  elements.missingTable.innerHTML = tableFromRows([
    { label: "Column", value: "column" },
    { label: "Missing values", value: "missing" },
  ], rows);
};

const renderNumericSummary = () => {
  if (!state.numericColumns.length) {
    elements.numericSummary.innerHTML = "<p class=\"helper\">No numeric columns detected.</p>";
    return;
  }

  const rows = state.numericColumns.map((column) => {
    const values = state.raw
      .map((row) => Number(row[column]))
      .filter((value) => !Number.isNaN(value));
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const medianValue =
      sorted.length % 2 === 0 && sorted.length
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    return {
      column,
      min: values.length ? Math.min(...values).toFixed(2) : "-",
      max: values.length ? Math.max(...values).toFixed(2) : "-",
      mean: values.length ? (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2) : "-",
      median: values.length ? medianValue.toFixed(2) : "-",
    };
  });

  elements.numericSummary.innerHTML = tableFromRows([
    { label: "Column", value: "column" },
    { label: "Min", value: "min" },
    { label: "Max", value: "max" },
    { label: "Mean", value: "mean" },
    { label: "Median", value: "median" },
  ], rows);
};

const renderFilterControls = () => {
  const options = ["", ...state.columns];
  elements.filterColumn.innerHTML = options
    .map((column) => `<option value="${column}">${column || "All columns"}</option>`)
    .join("");

  elements.filterColumn.value = state.filter.column;
  elements.filterValue.value = state.filter.value;
};

const getFilteredRows = () => {
  const { column, value } = state.filter;
  if (!value) {
    return [...state.raw];
  }

  const lower = value.toLowerCase();
  return state.raw.filter((row) => {
    if (column) {
      return String(row[column] ?? "").toLowerCase().includes(lower);
    }

    return state.columns.some((col) => String(row[col] ?? "").toLowerCase().includes(lower));
  });
};

const renderTable = () => {
  if (!state.columns.length) {
    elements.dataTable.innerHTML = "<p class=\"helper\">Load data to see the table.</p>";
    return;
  }

  let rows = getFilteredRows();

  if (state.sort.column) {
    const { column, direction } = state.sort;
    rows = [...rows].sort((a, b) => {
      const aValue = a[column] ?? "";
      const bValue = b[column] ?? "";
      const aNumber = Number(aValue);
      const bNumber = Number(bValue);
      if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber)) {
        return direction * (aNumber - bNumber);
      }
      return direction * String(aValue).localeCompare(String(bValue));
    });
  }

  const header = `<tr class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">${state.columns
    .map((column) => {
      const isSorted = state.sort.column === column;
      const arrow = isSorted ? (state.sort.direction === 1 ? "▲" : "▼") : "";
      return `<th data-column="${column}" class="cursor-pointer whitespace-nowrap px-4 py-3 text-left font-semibold">${column} <span class="ml-1 text-[10px] text-indigo-500">${arrow}</span></th>`;
    })
    .join("")}</tr>`;

  const body = rows
    .map(
      (row) =>
        `<tr class="border-t border-slate-200">${state.columns
          .map((column) => `<td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600">${row[column] ?? ""}</td>`)
          .join("")}</tr>`
    )
    .join("");

  elements.dataTable.innerHTML = `<table class="w-full border-collapse">${header ? `<thead>${header}</thead>` : ""}<tbody>${body}</tbody></table>`;

  elements.dataTable.querySelectorAll("th").forEach((th) => {
    th.addEventListener("click", () => {
      const column = th.dataset.column;
      if (state.sort.column === column) {
        state.sort.direction *= -1;
      } else {
        state.sort.column = column;
        state.sort.direction = 1;
      }
      renderTable();
    });
  });
};

const renderCharts = () => {
  renderSelectOptions(elements.histogramColumn, state.numericColumns, state.numericColumns[0]);
  renderSelectOptions(elements.categoryColumn, state.categoricalColumns, state.categoricalColumns[0]);
  renderSelectOptions(elements.scatterX, state.numericColumns, state.numericColumns[0]);
  renderSelectOptions(elements.scatterY, state.numericColumns, state.numericColumns[1] || state.numericColumns[0]);

  renderHistogram();
  renderCategoryChart();
  renderScatter();
};

const renderSelectOptions = (select, options, fallback) => {
  select.innerHTML = options.map((option) => `<option value="${option}">${option}</option>`).join("");
  if (fallback) {
    select.value = fallback;
  }
};

const renderHistogram = () => {
  const column = elements.histogramColumn.value;
  const values = getFilteredRows()
    .map((row) => Number(row[column]))
    .filter((value) => !Number.isNaN(value));

  destroyChart("histogram");

  if (!values.length) {
    return;
  }

  const bins = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const binSize = range / bins;
  const counts = Array.from({ length: bins }, () => 0);

  values.forEach((value) => {
    const index = Math.min(bins - 1, Math.floor((value - min) / binSize));
    counts[index] += 1;
  });

  const labels = counts.map((_, idx) => `${(min + idx * binSize).toFixed(1)} - ${(min + (idx + 1) * binSize).toFixed(1)}`);

  state.charts.histogram = new Chart(document.getElementById("histogram"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: `Distribution of ${column}`,
          data: counts,
          backgroundColor: "rgba(79, 70, 229, 0.7)",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      },
    },
  });
};

const renderCategoryChart = () => {
  const column = elements.categoryColumn.value;
  destroyChart("category");

  if (!column) {
    return;
  }

  const counts = {};
  getFilteredRows().forEach((row) => {
    const key = row[column] ?? "Unknown";
    counts[key] = (counts[key] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  state.charts.category = new Chart(document.getElementById("category-chart"), {
    type: "bar",
    data: {
      labels: sorted.map(([label]) => label),
      datasets: [
        {
          label: `Top ${column} values`,
          data: sorted.map(([, value]) => value),
          backgroundColor: "rgba(16, 185, 129, 0.7)",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      },
    },
  });
};

const renderScatter = () => {
  const xColumn = elements.scatterX.value;
  const yColumn = elements.scatterY.value;
  destroyChart("scatter");

  if (!xColumn || !yColumn) {
    return;
  }

  const points = getFilteredRows()
    .map((row) => ({
      x: Number(row[xColumn]),
      y: Number(row[yColumn]),
    }))
    .filter((point) => !Number.isNaN(point.x) && !Number.isNaN(point.y));

  state.charts.scatter = new Chart(document.getElementById("scatter-chart"), {
    type: "scatter",
    data: {
      datasets: [
        {
          label: `${xColumn} vs ${yColumn}`,
          data: points,
          backgroundColor: "rgba(59, 130, 246, 0.7)",
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        x: { title: { display: true, text: xColumn } },
        y: { title: { display: true, text: yColumn } },
      },
    },
  });
};

const destroyChart = (key) => {
  if (state.charts[key]) {
    state.charts[key].destroy();
    state.charts[key] = null;
  }
};

const tableFromRows = (columns, rows) => {
  const header = `<tr class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">${columns
    .map((column) => `<th class="px-4 py-3 text-left font-semibold">${column.label}</th>`)
    .join("")}</tr>`;
  const body = rows
    .map(
      (row) =>
        `<tr class="border-t border-slate-200">${columns
          .map((column) => `<td class="px-4 py-3 text-sm text-slate-600">${row[column.value]}</td>`)
          .join("")}</tr>`
    )
    .join("");
  return `<table class="w-full border-collapse"><thead>${header}</thead><tbody>${body}</tbody></table>`;
};

elements.parseButton.addEventListener("click", () => {
  parseCsv(elements.csvInput.value);
});

elements.clearButton.addEventListener("click", () => {
  elements.csvInput.value = "";
});

elements.loadData.addEventListener("click", () => {
  loadDataFile();
});

elements.fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    parseCsv(loadEvent.target.result);
  };
  reader.readAsText(file);
});

elements.filterColumn.addEventListener("change", (event) => {
  state.filter.column = event.target.value;
  renderTable();
});

elements.filterValue.addEventListener("input", (event) => {
  state.filter.value = event.target.value;
  renderTable();
});

elements.clearFilter.addEventListener("click", () => {
  state.filter = { column: "", value: "" };
  renderFilterControls();
  renderTable();
});

elements.histogramColumn.addEventListener("change", renderHistogram);

elements.categoryColumn.addEventListener("change", renderCategoryChart);

elements.scatterX.addEventListener("change", renderScatter);

elements.scatterY.addEventListener("change", renderScatter);

loadDataFile();
