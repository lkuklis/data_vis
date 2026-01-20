const dataUrl = "data.csv";

const app = angular.module("csvExplorer", []);

app.service("DataService", ["$http", function ($http) {
  const service = {
    raw: [],
    columns: [],
    numericColumns: [],
    categoricalColumns: [],
    sort: { column: null, direction: 1 },
    filter: { column: "", value: "" },
    status: { message: "Loading data.csv…", isError: false },
    version: 0,
  };

  const refresh = () => {
    service.version += 1;
  };

  const updateStatus = (message, isError = false) => {
    service.status.message = message;
    service.status.isError = isError;
  };

  const updateColumnTypes = () => {
    const numericColumns = [];
    const categoricalColumns = [];

    service.columns.forEach((column) => {
      const values = service.raw
        .map((row) => row[column])
        .filter((value) => value !== null && value !== undefined && String(value).trim() !== "");
      const numericCount = values.filter((value) => !Number.isNaN(Number(value))).length;
      if (values.length && numericCount / values.length >= 0.7) {
        numericColumns.push(column);
      } else {
        categoricalColumns.push(column);
      }
    });

    service.numericColumns = numericColumns;
    service.categoricalColumns = categoricalColumns;
  };

  const parseCsv = (csvText) => {
    const result = Papa.parse(csvText.trim(), {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });

    if (result.errors.length) {
      updateStatus(`CSV parse error: ${result.errors[0].message}`, true);
      return;
    }

    service.raw = result.data;
    service.columns = result.meta.fields || [];
    service.sort = { column: null, direction: 1 };
    service.filter = { column: "", value: "" };
    updateColumnTypes();
    refresh();
    updateStatus(`Loaded ${service.raw.length} rows from CSV.`);
  };

  const loadDataFile = () => {
    updateStatus("Loading data.csv…");
    return $http
      .get(dataUrl)
      .then((response) => {
        parseCsv(response.data);
      })
      .catch((error) => {
        const status = error.status ? ` (${error.status})` : "";
        updateStatus(`Could not load data.csv${status}.`, true);
      });
  };

  const countMissing = (column) =>
    service.raw.filter((row) => row[column] === null || row[column] === undefined || String(row[column]).trim() === "")
      .length;

  const getMissingTableRows = () =>
    service.columns
      .map((column) => ({ column, missing: countMissing(column) }))
      .sort((a, b) => b.missing - a.missing);

  const getNumericSummaryRows = () =>
    service.numericColumns.map((column) => {
      const values = service.raw
        .map((row) => Number(row[column]))
        .filter((value) => !Number.isNaN(value));
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const medianValue =
        sorted.length % 2 === 0 && sorted.length ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      return {
        column,
        min: values.length ? Math.min(...values).toFixed(2) : "-",
        max: values.length ? Math.max(...values).toFixed(2) : "-",
        mean: values.length ? (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2) : "-",
        median: values.length ? medianValue.toFixed(2) : "-",
      };
    });

  const getFilteredRows = () => {
    const { column, value } = service.filter;
    if (!value) {
      return [...service.raw];
    }

    const lower = value.toLowerCase();
    return service.raw.filter((row) => {
      if (column) {
        return String(row[column] ?? "").toLowerCase().includes(lower);
      }

      return service.columns.some((col) => String(row[col] ?? "").toLowerCase().includes(lower));
    });
  };

  const setFilter = (filter) => {
    service.filter = { ...filter };
    refresh();
  };

  const setSort = (sort) => {
    service.sort = { ...sort };
    refresh();
  };

  return {
    service,
    parseCsv,
    loadDataFile,
    countMissing,
    getMissingTableRows,
    getNumericSummaryRows,
    getFilteredRows,
    setFilter,
    setSort,
    updateStatus,
  };
}]);

app.directive("fileChange", () => ({
  restrict: "A",
  scope: {
    fileChange: "&",
  },
  link: (scope, element) => {
    element.on("change", (event) => {
      const file = event.target.files[0];
      if (file) {
        scope.$apply(() => {
          scope.fileChange({ file });
        });
      }
    });
  },
}));

app.component("appRoot", {
  template: `
    <csv-header></csv-header>
    <main class="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <csv-loader></csv-loader>
      <csv-summary></csv-summary>
      <csv-filter-table></csv-filter-table>
      <csv-charts></csv-charts>
    </main>
    <app-footer></app-footer>
  `,
});

app.component("csvHeader", {
  template: `
    <header class="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 text-white">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-10">
        <div>
          <p class="text-sm uppercase tracking-[0.2em] text-white/70">CSV Explorer</p>
          <h1 class="mt-2 text-3xl font-semibold sm:text-4xl">Explore your data instantly</h1>
          <p class="mt-3 max-w-2xl text-base text-white/80">
            Load the bundled dataset or paste your own CSV to run quick EDA, slice and filter records, and build
            interactive charts.
          </p>
        </div>
        <button
          class="rounded-full bg-white px-5 py-2 text-sm font-semibold text-indigo-700 shadow hover:bg-indigo-50"
          type="button"
          ng-click="$ctrl.reload()"
        >
          Reload data.csv
        </button>
      </div>
    </header>
  `,
  controller: ["DataService", function (DataService) {
    const ctrl = this;
    ctrl.reload = () => {
      DataService.loadDataFile();
    };
  }],
});

app.component("csvLoader", {
  template: `
    <section class="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/70">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold">Load data</h2>
          <p class="text-sm text-slate-500">Bring in the CSV you want to explore.</p>
        </div>
      </div>
      <div class="mt-6 grid gap-6 lg:grid-cols-[1.4fr,1fr]">
        <div>
          <label class="text-sm font-semibold text-slate-700" for="csv-input">Paste CSV data</label>
          <textarea
            id="csv-input"
            rows="10"
            class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="name,category,amount,score\nAlpha,A,12,88"
            ng-model="$ctrl.csvText"
          ></textarea>
          <div class="mt-4 flex flex-wrap gap-3">
            <button
              class="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500"
              type="button"
              ng-click="$ctrl.parseCsv()"
            >
              Parse pasted CSV
            </button>
            <button
              class="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
              type="button"
              ng-click="$ctrl.clearCsv()"
            >
              Clear
            </button>
          </div>
          <p
            class="mt-3 text-sm"
            ng-class="{ 'text-red-600 font-semibold': $ctrl.status.isError, 'text-slate-500': !$ctrl.status.isError }"
          >
            {{$ctrl.status.message}}
          </p>
        </div>
        <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5">
          <label class="text-sm font-semibold text-slate-700" for="csv-file">Upload CSV file</label>
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            class="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
            file-change="$ctrl.handleFile(file)"
          />
          <p class="mt-4 text-sm text-slate-500">Files stay in your browser; nothing is uploaded.</p>
        </div>
      </div>
    </section>
  `,
  controller: ["DataService", function (DataService) {
    const ctrl = this;
    ctrl.csvText = "";
    ctrl.status = DataService.service.status;

    ctrl.parseCsv = () => {
      if (!ctrl.csvText.trim()) {
        DataService.updateStatus("Paste CSV text to parse.", true);
        return;
      }
      DataService.parseCsv(ctrl.csvText);
    };

    ctrl.clearCsv = () => {
      ctrl.csvText = "";
    };

    ctrl.handleFile = (file) => {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        DataService.parseCsv(loadEvent.target.result);
      };
      reader.readAsText(file);
    };
  }],
});

app.component("csvSummary", {
  template: `
    <section class="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/70">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold">Exploratory summary</h2>
          <p class="text-sm text-slate-500">Quick signals on shape, missingness, and numeric stats.</p>
        </div>
      </div>
      <div class="mt-6 grid gap-4 sm:grid-cols-3">
        <div class="rounded-2xl bg-indigo-50 p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-indigo-600">Rows</p>
          <p class="mt-2 text-2xl font-semibold text-indigo-900">{{$ctrl.rowCount}}</p>
        </div>
        <div class="rounded-2xl bg-indigo-50 p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-indigo-600">Columns</p>
          <p class="mt-2 text-2xl font-semibold text-indigo-900">{{$ctrl.columnCount}}</p>
        </div>
        <div class="rounded-2xl bg-indigo-50 p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-indigo-600">Missing values</p>
          <p class="mt-2 text-2xl font-semibold text-indigo-900">{{$ctrl.missingCount}}</p>
        </div>
      </div>
      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 class="text-sm font-semibold text-slate-600">Missing values by column</h3>
          <div class="mt-3 overflow-hidden rounded-2xl border border-slate-200">
            <table class="w-full border-collapse" ng-if="$ctrl.missingRows.length">
              <thead>
                <tr class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th class="px-4 py-3 text-left font-semibold">Column</th>
                  <th class="px-4 py-3 text-left font-semibold">Missing values</th>
                </tr>
              </thead>
              <tbody>
                <tr class="border-t border-slate-200" ng-repeat="row in $ctrl.missingRows">
                  <td class="px-4 py-3 text-sm text-slate-600">{{row.column}}</td>
                  <td class="px-4 py-3 text-sm text-slate-600">{{row.missing}}</td>
                </tr>
              </tbody>
            </table>
            <p class="px-4 py-3 text-sm text-slate-500" ng-if="!$ctrl.missingRows.length">
              Load data to see missing values.
            </p>
          </div>
        </div>
        <div>
          <h3 class="text-sm font-semibold text-slate-600">Numeric summary</h3>
          <div class="mt-3 overflow-hidden rounded-2xl border border-slate-200">
            <table class="w-full border-collapse" ng-if="$ctrl.numericRows.length">
              <thead>
                <tr class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th class="px-4 py-3 text-left font-semibold">Column</th>
                  <th class="px-4 py-3 text-left font-semibold">Min</th>
                  <th class="px-4 py-3 text-left font-semibold">Max</th>
                  <th class="px-4 py-3 text-left font-semibold">Mean</th>
                  <th class="px-4 py-3 text-left font-semibold">Median</th>
                </tr>
              </thead>
              <tbody>
                <tr class="border-t border-slate-200" ng-repeat="row in $ctrl.numericRows">
                  <td class="px-4 py-3 text-sm text-slate-600">{{row.column}}</td>
                  <td class="px-4 py-3 text-sm text-slate-600">{{row.min}}</td>
                  <td class="px-4 py-3 text-sm text-slate-600">{{row.max}}</td>
                  <td class="px-4 py-3 text-sm text-slate-600">{{row.mean}}</td>
                  <td class="px-4 py-3 text-sm text-slate-600">{{row.median}}</td>
                </tr>
              </tbody>
            </table>
            <p class="px-4 py-3 text-sm text-slate-500" ng-if="!$ctrl.numericRows.length">
              No numeric columns detected.
            </p>
          </div>
        </div>
      </div>
    </section>
  `,
  controller: ["$scope", "DataService", function ($scope, DataService) {
    const ctrl = this;

    const refresh = () => {
      ctrl.rowCount = DataService.service.raw.length;
      ctrl.columnCount = DataService.service.columns.length;
      ctrl.missingCount = DataService.service.columns.reduce(
        (sum, column) => sum + DataService.countMissing(column),
        0
      );
      ctrl.missingRows = DataService.getMissingTableRows();
      ctrl.numericRows = DataService.getNumericSummaryRows();
    };

    $scope.$watch(
      () => DataService.service.version,
      () => {
        refresh();
      }
    );

    refresh();
  }],
});

app.component("csvFilterTable", {
  template: `
    <section class="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/70">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-xl font-semibold">Filter &amp; sort</h2>
          <p class="text-sm text-slate-500">Focus on the records that matter most.</p>
        </div>
        <button
          class="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
          type="button"
          ng-click="$ctrl.clearFilter()"
        >
          Clear filter
        </button>
      </div>
      <div class="mt-5 grid gap-4 md:grid-cols-[1fr,1fr]">
        <div>
          <label class="text-sm font-semibold text-slate-700" for="filter-column">Filter column</label>
          <select
            id="filter-column"
            class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            ng-model="$ctrl.filter.column"
            ng-options="column as (column || 'All columns') for column in $ctrl.filterColumns"
            ng-change="$ctrl.onFilterChange()"
          ></select>
        </div>
        <div>
          <label class="text-sm font-semibold text-slate-700" for="filter-value">Filter value (contains)</label>
          <input
            id="filter-value"
            type="text"
            placeholder="Type to filter"
            class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            ng-model="$ctrl.filter.value"
            ng-change="$ctrl.onFilterChange()"
          />
        </div>
      </div>
      <div class="mt-6 overflow-hidden rounded-2xl border border-slate-200">
        <table class="w-full border-collapse" ng-if="$ctrl.rows.length">
          <thead>
            <tr class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th
                class="cursor-pointer whitespace-nowrap px-4 py-3 text-left font-semibold"
                ng-repeat="column in $ctrl.columns"
                ng-click="$ctrl.toggleSort(column)"
              >
                {{column}}
                <span class="ml-1 text-[10px] text-indigo-500" ng-if="$ctrl.sort.column === column">
                  {{$ctrl.sort.direction === 1 ? '▲' : '▼'}}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-t border-slate-200" ng-repeat="row in $ctrl.rows">
              <td class="whitespace-nowrap px-4 py-3 text-sm text-slate-600" ng-repeat="column in $ctrl.columns">
                {{row[column] || ''}}
              </td>
            </tr>
          </tbody>
        </table>
        <p class="px-4 py-3 text-sm text-slate-500" ng-if="!$ctrl.columns.length">
          Load data to see the table.
        </p>
      </div>
    </section>
  `,
  controller: ["$scope", "DataService", function ($scope, DataService) {
    const ctrl = this;

    const applySort = (rows) => {
      if (!ctrl.sort.column) {
        return rows;
      }
      const { column, direction } = ctrl.sort;
      return [...rows].sort((a, b) => {
        const aValue = a[column] ?? "";
        const bValue = b[column] ?? "";
        const aNumber = Number(aValue);
        const bNumber = Number(bValue);
        if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber)) {
          return direction * (aNumber - bNumber);
        }
        return direction * String(aValue).localeCompare(String(bValue));
      });
    };

    const refresh = () => {
      ctrl.columns = DataService.service.columns;
      ctrl.filterColumns = ["", ...ctrl.columns];
      ctrl.sort = DataService.service.sort;
      ctrl.rows = applySort(DataService.getFilteredRows());
    };

    ctrl.filter = { ...DataService.service.filter };

    ctrl.onFilterChange = () => {
      DataService.setFilter(ctrl.filter);
      refresh();
    };

    ctrl.toggleSort = (column) => {
      if (ctrl.sort.column === column) {
        ctrl.sort.direction *= -1;
      } else {
        ctrl.sort = { column, direction: 1 };
      }
      DataService.setSort(ctrl.sort);
      refresh();
    };

    ctrl.clearFilter = () => {
      ctrl.filter = { column: "", value: "" };
      DataService.setFilter(ctrl.filter);
      refresh();
    };

    $scope.$watch(
      () => DataService.service.version,
      () => {
        refresh();
      }
    );

    refresh();
  }],
});

app.component("csvCharts", {
  template: `
    <section class="rounded-3xl bg-white p-6 shadow-lg shadow-slate-200/70">
      <div>
        <h2 class="text-xl font-semibold">Charts</h2>
        <p class="text-sm text-slate-500">Visualize distributions, category performance, and correlations.</p>
      </div>
      <div class="mt-6 grid gap-6 lg:grid-cols-3">
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="text-sm font-semibold text-slate-600">Histogram</h3>
            <select
              class="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
              ng-model="$ctrl.histogramColumn"
              ng-options="column for column in $ctrl.numericColumns"
            ></select>
          </div>
          <div class="mt-4 rounded-xl bg-white p-3 shadow-sm">
            <canvas class="js-histogram"></canvas>
          </div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="text-sm font-semibold text-slate-600">Category counts</h3>
            <select
              class="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
              ng-model="$ctrl.categoryColumn"
              ng-options="column for column in $ctrl.categoricalColumns"
            ></select>
          </div>
          <div class="mt-4 rounded-xl bg-white p-3 shadow-sm">
            <canvas class="js-category"></canvas>
          </div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="text-sm font-semibold text-slate-600">Scatter plot</h3>
            <div class="flex flex-wrap gap-2">
              <select
                class="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                ng-model="$ctrl.scatterX"
                ng-options="column for column in $ctrl.numericColumns"
              ></select>
              <select
                class="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                ng-model="$ctrl.scatterY"
                ng-options="column for column in $ctrl.numericColumns"
              ></select>
            </div>
          </div>
          <div class="mt-4 rounded-xl bg-white p-3 shadow-sm">
            <canvas class="js-scatter"></canvas>
          </div>
        </div>
      </div>
    </section>
  `,
  controller: ["$scope", "$element", "DataService", function ($scope, $element, DataService) {
    const ctrl = this;
    const charts = {
      histogram: null,
      category: null,
      scatter: null,
    };

    const getHistogramCanvas = () => $element[0].querySelector(".js-histogram");
    const getCategoryCanvas = () => $element[0].querySelector(".js-category");
    const getScatterCanvas = () => $element[0].querySelector(".js-scatter");

    const destroyChart = (key) => {
      if (charts[key]) {
        charts[key].destroy();
        charts[key] = null;
      }
    };

    const syncColumns = () => {
      ctrl.numericColumns = DataService.service.numericColumns;
      ctrl.categoricalColumns = DataService.service.categoricalColumns;

      if (!ctrl.numericColumns.includes(ctrl.histogramColumn)) {
        ctrl.histogramColumn = ctrl.numericColumns[0] || "";
      }
      if (!ctrl.categoricalColumns.includes(ctrl.categoryColumn)) {
        ctrl.categoryColumn = ctrl.categoricalColumns[0] || "";
      }
      if (!ctrl.numericColumns.includes(ctrl.scatterX)) {
        ctrl.scatterX = ctrl.numericColumns[0] || "";
      }
      if (!ctrl.numericColumns.includes(ctrl.scatterY)) {
        ctrl.scatterY = ctrl.numericColumns[1] || ctrl.numericColumns[0] || "";
      }
    };

    const renderHistogram = () => {
      destroyChart("histogram");
      if (!ctrl.histogramColumn) {
        return;
      }
      const values = DataService.getFilteredRows()
        .map((row) => Number(row[ctrl.histogramColumn]))
        .filter((value) => !Number.isNaN(value));
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

      const labels = counts.map(
        (_, idx) => `${(min + idx * binSize).toFixed(1)} - ${(min + (idx + 1) * binSize).toFixed(1)}`
      );

      charts.histogram = new Chart(getHistogramCanvas(), {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: `Distribution of ${ctrl.histogramColumn}`,
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
      destroyChart("category");
      if (!ctrl.categoryColumn) {
        return;
      }
      const counts = {};
      DataService.getFilteredRows().forEach((row) => {
        const key = row[ctrl.categoryColumn] ?? "Unknown";
        counts[key] = (counts[key] || 0) + 1;
      });
      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      charts.category = new Chart(getCategoryCanvas(), {
        type: "bar",
        data: {
          labels: sorted.map(([label]) => label),
          datasets: [
            {
              label: `Top ${ctrl.categoryColumn} values`,
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
      destroyChart("scatter");
      if (!ctrl.scatterX || !ctrl.scatterY) {
        return;
      }
      const points = DataService.getFilteredRows()
        .map((row) => ({
          x: Number(row[ctrl.scatterX]),
          y: Number(row[ctrl.scatterY]),
        }))
        .filter((point) => !Number.isNaN(point.x) && !Number.isNaN(point.y));

      charts.scatter = new Chart(getScatterCanvas(), {
        type: "scatter",
        data: {
          datasets: [
            {
              label: `${ctrl.scatterX} vs ${ctrl.scatterY}`,
              data: points,
              backgroundColor: "rgba(59, 130, 246, 0.7)",
            },
          ],
        },
        options: {
          responsive: true,
          scales: {
            x: { title: { display: true, text: ctrl.scatterX } },
            y: { title: { display: true, text: ctrl.scatterY } },
          },
        },
      });
    };

    const renderCharts = () => {
      syncColumns();
      renderHistogram();
      renderCategoryChart();
      renderScatter();
    };

    $scope.$watchGroup(
      [
        () => DataService.service.version,
        () => ctrl.histogramColumn,
        () => ctrl.categoryColumn,
        () => ctrl.scatterX,
        () => ctrl.scatterY,
      ],
      () => {
        renderCharts();
      }
    );

    ctrl.$onDestroy = () => {
      Object.keys(charts).forEach((key) => destroyChart(key));
    };

    renderCharts();
  }],
});

app.component("appFooter", {
  template: `
    <footer class="py-10 text-center text-sm text-slate-400">
      <p>Tip: if you cannot upload a file, the bundled data.csv loads automatically or you can paste CSV text.</p>
    </footer>
  `,
});

app.run(["DataService", function (DataService) {
  DataService.loadDataFile();
}]);
