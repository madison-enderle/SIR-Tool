const DEFAULTS = {
  population: 100,
  initialInfected: 1,
  initialRecovered: 0,
  beta: 0.5,
  duration: 7,
  betaProportion: 1,
  gammaProportion: 1,
  timeHorizon: 100,
  timeStep: 1,
};

const COLORS = {
  susceptible: '#2563eb',
  infected: '#dc2626',
  recovered: '#16a34a',
};

const inputElements = {
  population: document.getElementById('population'),
  initialInfected: document.getElementById('initial-infected'),
  initialRecovered: document.getElementById('initial-recovered'),
  beta: document.getElementById('beta'),
  duration: document.getElementById('duration'),
  betaProportion: document.getElementById('beta-proportion'),
  gammaProportion: document.getElementById('gamma-proportion'),
  timeHorizon: document.getElementById('time-horizon'),
  timeStep: document.getElementById('time-step'),
};

const displayElements = {
  betaProportionValue: document.getElementById('beta-proportion-value'),
  gammaProportionValue: document.getElementById('gamma-proportion-value'),
  validationMessage: document.getElementById('validation-message'),
  baselineS0: document.getElementById('baseline-s0'),
  baselineBeta: document.getElementById('baseline-beta'),
  baselineGamma: document.getElementById('baseline-gamma'),
  modifiedBeta: document.getElementById('modified-beta'),
  modifiedGamma: document.getElementById('modified-gamma'),
  baselineSummary: document.getElementById('baseline-summary'),
  modifiedSummary: document.getElementById('modified-summary'),
  resetButton: document.getElementById('reset-button'),
};

let baselineChart;
let modifiedChart;

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return '—';
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function setDefaults() {
  inputElements.population.value = DEFAULTS.population;
  inputElements.initialInfected.value = DEFAULTS.initialInfected;
  inputElements.initialRecovered.value = DEFAULTS.initialRecovered;
  inputElements.beta.value = DEFAULTS.beta;
  inputElements.duration.value = DEFAULTS.duration;
  inputElements.betaProportion.value = DEFAULTS.betaProportion;
  inputElements.gammaProportion.value = DEFAULTS.gammaProportion;
  inputElements.timeHorizon.value = DEFAULTS.timeHorizon;
  inputElements.timeStep.value = DEFAULTS.timeStep;
  updateSliderDisplays();
}

function getInputs() {
  return {
    population: Number(inputElements.population.value),
    initialInfected: Number(inputElements.initialInfected.value),
    initialRecovered: Number(inputElements.initialRecovered.value),
    beta: Number(inputElements.beta.value),
    duration: Number(inputElements.duration.value),
    betaProportion: Number(inputElements.betaProportion.value),
    gammaProportion: Number(inputElements.gammaProportion.value),
    timeHorizon: Number(inputElements.timeHorizon.value),
    timeStep: Number(inputElements.timeStep.value),
  };
}

function validateInputs(values) {
  const errors = [];

  if (!Number.isFinite(values.population) || values.population < 1 || !Number.isInteger(values.population)) {
    errors.push('Population size must be an integer greater than or equal to 1.');
  }

  if (!Number.isFinite(values.initialInfected) || values.initialInfected < 0 || !Number.isInteger(values.initialInfected)) {
    errors.push('Initial infected must be a whole number greater than or equal to 0.');
  }

  if (!Number.isFinite(values.initialRecovered) || values.initialRecovered < 0 || !Number.isInteger(values.initialRecovered)) {
    errors.push('Initial recovered must be a whole number greater than or equal to 0.');
  }

  if (Number.isFinite(values.population) && Number.isFinite(values.initialInfected) && Number.isFinite(values.initialRecovered)) {
    if (values.initialInfected + values.initialRecovered > values.population) {
      errors.push('Initial infected plus initial recovered cannot exceed the population size.');
    }
  }

  if (!Number.isFinite(values.beta) || values.beta < 0) {
    errors.push('Infection rate β must be a non-negative number.');
  }

  if (!Number.isFinite(values.duration) || values.duration <= 0) {
    errors.push('Duration of infection must be greater than 0.');
  }

  if (!Number.isFinite(values.timeHorizon) || values.timeHorizon <= 0 || values.timeHorizon > 365) {
    errors.push('Time horizon must be greater than 0 and no more than 365 days.');
  }

  if (!Number.isFinite(values.timeStep) || values.timeStep < 0.01 || values.timeStep > 1) {
    errors.push('Time step must be between 0.01 and 1 day.');
  }

  if (!Number.isFinite(values.betaProportion) || values.betaProportion < 0 || values.betaProportion > 1) {
    errors.push('Infection-rate proportion must be between 0 and 1.');
  }

  if (!Number.isFinite(values.gammaProportion) || values.gammaProportion <= 0 || values.gammaProportion > 1) {
    errors.push('Recovery-rate proportion must be greater than 0 and no more than 1.');
  }

  return errors;
}

function updateSliderDisplays() {
  displayElements.betaProportionValue.textContent = Number(inputElements.betaProportion.value).toFixed(2);
  displayElements.gammaProportionValue.textContent = Number(inputElements.gammaProportion.value).toFixed(2);
}

function renderValidation(errors) {
  const message = displayElements.validationMessage;

  if (errors.length === 0) {
    message.textContent = '';
    message.classList.remove('visible');
    return;
  }

  message.textContent = errors.join(' ');
  message.classList.add('visible');
}

function updateDerivedValues(values) {
  const s0 = values.population - values.initialInfected - values.initialRecovered;
  const gamma = 1 / values.duration;
  const modifiedBeta = values.beta * values.betaProportion;
  const modifiedGamma = 1 / (values.duration * values.gammaProportion);

  displayElements.baselineS0.textContent = formatNumber(s0, 2);
  displayElements.baselineBeta.textContent = formatNumber(values.beta, 4);
  displayElements.baselineGamma.textContent = formatNumber(gamma, 4);
  displayElements.modifiedBeta.textContent = formatNumber(modifiedBeta, 4);
  displayElements.modifiedGamma.textContent = formatNumber(modifiedGamma, 4);
}

function derivatives(state, beta, gamma, population) {
  const infectionFlow = beta * state.s * state.i / population;

  return {
    ds: -infectionFlow,
    di: infectionFlow - gamma * state.i,
    dr: gamma * state.i,
  };
}

function addScaledState(state, delta, scale) {
  return {
    s: state.s + delta.ds * scale,
    i: state.i + delta.di * scale,
    r: state.r + delta.dr * scale,
  };
}

function normalizeState(state, population) {
  const normalized = {
    s: Math.max(0, state.s),
    i: Math.max(0, state.i),
    r: Math.max(0, state.r),
  };

  const total = normalized.s + normalized.i + normalized.r;

  if (total === 0) {
    return { s: population, i: 0, r: 0 };
  }

  const scale = population / total;
  return {
    s: normalized.s * scale,
    i: normalized.i * scale,
    r: normalized.r * scale,
  };
}

function rk4Step(state, dt, beta, gamma, population) {
  const k1 = derivatives(state, beta, gamma, population);
  const k2 = derivatives(addScaledState(state, k1, dt / 2), beta, gamma, population);
  const k3 = derivatives(addScaledState(state, k2, dt / 2), beta, gamma, population);
  const k4 = derivatives(addScaledState(state, k3, dt), beta, gamma, population);

  const next = {
    s: state.s + (dt / 6) * (k1.ds + 2 * k2.ds + 2 * k3.ds + k4.ds),
    i: state.i + (dt / 6) * (k1.di + 2 * k2.di + 2 * k3.di + k4.di),
    r: state.r + (dt / 6) * (k1.dr + 2 * k2.dr + 2 * k3.dr + k4.dr),
  };

  return normalizeState(next, population);
}

function simulateSir({ population, initialInfected, initialRecovered, beta, gamma, timeHorizon, timeStep }) {
  const points = [];
  let t = 0;
  let state = {
    s: population - initialInfected - initialRecovered,
    i: initialInfected,
    r: initialRecovered,
  };

  points.push({ time: t, s: state.s, i: state.i, r: state.r });

  while (t < timeHorizon) {
    const dt = Math.min(timeStep, timeHorizon - t);
    state = rk4Step(state, dt, beta, gamma, population);
    t += dt;

    points.push({
      time: Number(t.toFixed(10)),
      s: state.s,
      i: state.i,
      r: state.r,
    });
  }

  return points;
}

function buildSummary(points, population) {
  const finalPoint = points[points.length - 1];
  const peakPoint = points.reduce((peak, point) => (point.i > peak.i ? point : peak), points[0]);
  const cumulativeInfected = population - finalPoint.s;

  return {
    cumulativeInfected,
    peakInfected: peakPoint.i,
    peakDay: peakPoint.time,
    finalSusceptible: finalPoint.s,
    finalRecovered: finalPoint.r,
  };
}

function createSummaryMarkup(summary) {
  return [
    {
      title: 'Cumulative infected',
      value: formatNumber(summary.cumulativeInfected, 2),
    },
    {
      title: 'Peak infected',
      value: formatNumber(summary.peakInfected, 2),
    },
    {
      title: 'Day of peak',
      value: formatNumber(summary.peakDay, 2),
    },
    {
      title: 'Final recovered',
      value: formatNumber(summary.finalRecovered, 2),
    },
  ]
    .map(
      (item) => `
        <section class="summary-card">
          <h3>${item.title}</h3>
          <dl>
            <div>
              <dt>Value</dt>
              <dd>${item.value}</dd>
            </div>
          </dl>
        </section>
      `,
    )
    .join('');
}

function buildDatasets(points) {
  return [
    {
      label: 'Susceptible',
      data: points.map((point) => ({ x: point.time, y: point.s })),
      borderColor: COLORS.susceptible,
      backgroundColor: COLORS.susceptible,
    },
    {
      label: 'Infected',
      data: points.map((point) => ({ x: point.time, y: point.i })),
      borderColor: COLORS.infected,
      backgroundColor: COLORS.infected,
    },
    {
      label: 'Recovered',
      data: points.map((point) => ({ x: point.time, y: point.r })),
      borderColor: COLORS.recovered,
      backgroundColor: COLORS.recovered,
    },
  ].map((dataset) => ({
    ...dataset,
    borderWidth: 2,
    pointRadius: 0,
    tension: 0.18,
  }));
}

function createChart(canvasId, title, population, timeHorizon, points) {
  const context = document.getElementById(canvasId);

  return new Chart(context, {
    type: 'line',
    data: {
      datasets: buildDatasets(points),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
        },
        title: {
          display: false,
          text: title,
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max: timeHorizon,
          title: {
            display: true,
            text: 'Time (days)',
          },
        },
        y: {
          min: 0,
          max: population,
          title: {
            display: true,
            text: 'People',
          },
        },
      },
      elements: {
        line: {
          fill: false,
        },
      },
    },
  });
}

function updateChart(chart, population, timeHorizon, points) {
  chart.data.datasets = buildDatasets(points);
  chart.options.scales.x.max = timeHorizon;
  chart.options.scales.y.max = population;
  chart.update();
}

function render() {
  updateSliderDisplays();

  const values = getInputs();
  const errors = validateInputs(values);
  renderValidation(errors);

  if (errors.length > 0) {
    return;
  }

  updateDerivedValues(values);

  const gamma = 1 / values.duration;
  const modifiedBeta = values.beta * values.betaProportion;
  const modifiedGamma = 1 / (values.duration * values.gammaProportion);

  const baselinePoints = simulateSir({
    population: values.population,
    initialInfected: values.initialInfected,
    initialRecovered: values.initialRecovered,
    beta: values.beta,
    gamma,
    timeHorizon: values.timeHorizon,
    timeStep: values.timeStep,
  });

  const modifiedPoints = simulateSir({
    population: values.population,
    initialInfected: values.initialInfected,
    initialRecovered: values.initialRecovered,
    beta: modifiedBeta,
    gamma: modifiedGamma,
    timeHorizon: values.timeHorizon,
    timeStep: values.timeStep,
  });

  const baselineSummary = buildSummary(baselinePoints, values.population);
  const modifiedSummary = buildSummary(modifiedPoints, values.population);

  displayElements.baselineSummary.innerHTML = createSummaryMarkup(baselineSummary);
  displayElements.modifiedSummary.innerHTML = createSummaryMarkup(modifiedSummary);

  if (!baselineChart) {
    baselineChart = createChart('baseline-chart', 'Baseline scenario', values.population, values.timeHorizon, baselinePoints);
  } else {
    updateChart(baselineChart, values.population, values.timeHorizon, baselinePoints);
  }

  if (!modifiedChart) {
    modifiedChart = createChart('modified-chart', 'Modified scenario', values.population, values.timeHorizon, modifiedPoints);
  } else {
    updateChart(modifiedChart, values.population, values.timeHorizon, modifiedPoints);
  }
}

function attachListeners() {
  Object.values(inputElements).forEach((element) => {
    element.addEventListener('input', render);
  });

  displayElements.resetButton.addEventListener('click', () => {
    setDefaults();
    render();
  });
}

setDefaults();
attachListeners();
render();
