const margin = { top: 80, right: 60, bottom: 60, left: 100 };
const width = 800 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;
const t = 500;

const margin2 = { top: 80, right: 40, bottom: 60, left: 90 };
const width2 = 450 - margin2.left - margin2.right;
const height2 = 700 - margin2.top - margin2.bottom;

let allData = [],
  series = [],
  dis = [],
  barData = [];
let arrestVar = "All",
  metricVar = "count";
let selected = null,
  minYear,
  maxYear,
  yearRange;
let xScale, yScale, xScale2, yScale2, innerScale;

// Timeline panel
const svg = d3
  .select("#vis")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// District panel
const svg2 = d3
  .select("#vis")
  .append("svg")
  .attr("width", width2 + margin2.left + margin2.right)
  .attr("height", height2 + margin2.top + margin2.bottom)
  .append("g")
  .attr("transform", `translate(${margin2.left},${margin2.top})`);

const lin = svg.append("g");
const hov = svg.append("g").style("pointer-events", "none");
const clickbox = svg.append("g");
const disRow = svg2.append("g");
const disBar = svg2.append("g").style("pointer-events", "none");

const places = ["Residence", "Apartment"];
const colorScale = d3.scaleOrdinal(places, ['#d95f02', '#194475']);

const options = {
  arrestVariable: [
    { value: "All", label: "All" },
    { value: "Arrested", label: "Arrested" },
    { value: "No arrest", label: "No arrest" },
  ],
  metricVariable: [
    { value: "count", label: "Number of incidents" },
    { value: "rate", label: "Arrest rate (%)" },
  ],
};

const line = d3
  .line()
  .x((d) => xScale(d.year))
  .y((d) => yScale(d.value));

function init() {
  d3.csv("./data/Crimes_-_2001_to_Present_20261014.csv", function (d) {
    let loc = (d["Location Description"] || "").toUpperCase();
    let place = loc === "APARTMENT" ? "Apartment" : "Residence";
    return {
      year: +d["Year"],
      place: place,
      arrest: String(d["Arrest"]).toLowerCase() === "true",
      district: d["District"] ? String(+d["District"]) : "Unknown",
    };
  })
    .then((data) => {
    //   console.log(data);
      allData = data;
      minYear = d3.min(allData, (d) => d.year);
      maxYear = d3.max(allData, (d) => d.year);
      yearRange = [minYear, maxYear];
      setupSelector();

      updateAxes();
      updateVis();
      addLegend();
    })
    .catch((error) => console.error("Error loading data:", error));
}

// filter by year or district
function filterData(useYears, useDistrict) {
  return allData.filter(
    (d) =>
      (metricVar === "rate" ||
        arrestVar === "All" ||
        (arrestVar === "Arrested") === d.arrest) &&
      (!useYears || (d.year >= yearRange[0] && d.year <= yearRange[1])) &&
      (!useDistrict || selected === null || d.district === selected),
  );
}

function summarize(rows) {
  return { n: rows.length, a: d3.sum(rows, (d) => (d.arrest ? 1 : 0)) };
}

function getValue(o) {
  return metricVar === "rate" ? (o.n ? (100 * o.a) / o.n : 0) : o.n;
}

function setupSelector() {
  d3.selectAll(".variable")
    .each(function () {
      d3.select(this)
        .selectAll("myOptions")
        .data(options[this.id])
        .enter()
        .append("option")
        .text((d) => d.label)
        .attr("value", (d) => d.value);
    })
    .on("change", function (event) {
      if (d3.select(this).property("id") == "arrestVariable") {
        arrestVar = d3.select(this).property("value");
      }
      if (d3.select(this).property("id") == "metricVariable") {
        metricVar = d3.select(this).property("value");
        d3.select("#arrestVariable").property("disabled", metricVar === "rate");
      }
      updateAxes();
      updateVis();
    });

  clickbox
    .append("rect")
    .attr("width", width)
    .attr("height", height)
    .style("fill", "transparent")
    .style("cursor", "pointer");

  clickbox.on("click", function (event) {
    let yr = Math.round(xScale.invert(d3.pointer(event, svg.node())[0]));
    yr = Math.max(minYear, Math.min(maxYear, yr));
    if (yearRange[0] === yr && yearRange[1] === yr) {
      yearRange = [minYear, maxYear];
    } else {
      yearRange = [yr, yr];
    }
    updateAxes();
    updateVis();
  });

  let guide = hov
    .append("line")
    .attr("y1", 0)
    .attr("y2", height)
    .attr("stroke", "#999")
    .style("display", "none");
  let dots = hov
    .selectAll("circle")
    .data(places)
    .join("circle")
    .attr("r", 5)
    .attr("fill", (d) => colorScale(d))
    .attr("stroke", "white")
    .style("display", "none");

  clickbox
    .on("mousemove", function (event) {
      let yr = Math.round(xScale.invert(d3.pointer(event, svg.node())[0]));
      yr = Math.max(minYear, Math.min(maxYear, yr));
      let pts = series.map((s) => s.values.find((p) => p.year === yr));
      guide
        .attr("x1", xScale(yr))
        .attr("x2", xScale(yr))
        .style("display", "block");
      dots
        .attr("cx", xScale(yr))
        .attr("cy", (d, i) => yScale(pts[i].value))
        .style("display", "block");
      d3.select("#tooltip")
        .style("display", "block")
        .html(
          `<strong>${yr}</strong>` +
            pts
              .map(
                (p, i) =>
                  `<br/><span style="color:${colorScale(places[i])}">&#9679;</span> ${places[i]}: 
            ${d3.format(",")(p.n)} incidents, ${p.n ? ((100 * p.a) / p.n).toFixed(1) : 0}% arrested`,
              )
              .join(""),
        )
        .style("left", event.pageX + 20 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseleave", function () {
      guide.style("display", "none");
      dots.style("display", "none");
      d3.select("#tooltip").style("display", "none");
    });
}

function updateAxes() {
  svg.selectAll(".axis").remove();
  svg.selectAll(".labels").remove();
  svg2.selectAll(".axis").remove();
  svg2.selectAll(".labels").remove();

  let grouped = d3.rollup(
    filterData(false, true),
    summarize,
    (d) => d.place,
    (d) => d.year,
  );
  series = places.map((place) => ({
    place: place,
    values: d3.range(minYear, maxYear + 1).map((year) => {
      let o = grouped.get(place)?.get(year) || { n: 0, a: 0 };
      return { year: year, n: o.n, a: o.a, value: getValue(o) };
    }),
  }));

  xScale = d3.scaleLinear().domain([minYear, maxYear]).range([0, width]);

  const xAxis = d3.axisBottom(xScale).ticks(10).tickFormat(d3.format("d"));

  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height})`)
    .call(xAxis);

  yScale = d3
    .scaleLinear()
    .domain([
      0,
      d3.max(series, (s) => d3.max(s.values, (d) => d.value)) * 1.1 || 1,
    ])
    .range([height, 0])
    .nice();

  const yAxis = d3
    .axisLeft(yScale)
    .ticks(6)
    .tickFormat(metricVar === "rate" ? (d) => d + "%" : d3.format("~s"));

  svg.append("g").attr("class", "axis").call(yAxis);

  // shade selected year so clear which year the district chart shows
  svg.selectAll(".marker").remove();
  if (yearRange[0] === yearRange[1]) {
    let bandWidth = width / (maxYear - minYear);
    svg
      .append("rect")
      .attr("class", "marker")
      .attr("x", xScale(yearRange[0]) - bandWidth / 2)
      .attr("y", 0)
      .attr("width", bandWidth)
      .attr("height", height)
      .style("fill", "#888")
      .style("opacity", 0.15)
      .style("pointer-events", "none")
      .lower();
  }

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height + margin.bottom - 20)
    .attr("text-anchor", "middle")
    .text("Year")
    .attr("class", "labels");

  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -margin.left + 40)
    .attr("text-anchor", "middle")
    .text(metricVar === "rate" ? "Arrest rate" : "Incidents per year")
    .attr("class", "labels");

  let byDistrict = d3.rollup(
    filterData(true, false),
    summarize,
    (d) => d.district,
    (d) => d.place,
  );
  dis = Array.from(byDistrict, ([district, m]) => ({
    district: district,
    total: d3.sum(places, (p) => m.get(p)?.n || 0),
    values: places.map((p) => {
      let o = m.get(p) || { n: 0, a: 0 };
      return { place: p, n: o.n, a: o.a, value: getValue(o) };
    }),
  })).sort((a, b) => d3.descending(a.total, b.total));

  xScale2 = d3
    .scaleLinear()
    .domain([0, d3.max(dis, (d) => d3.max(d.values, (v) => v.value)) || 1])
    .range([0, width2])
    .nice();

  yScale2 = d3
    .scaleBand()
    .domain(dis.map((d) => d.district))
    .range([0, height2])
    .padding(0.25);

  innerScale = d3
    .scaleBand()
    .domain(places)
    .range([0, yScale2.bandwidth()])
    .padding(0.08);

  barData = dis.flatMap((row) =>
    row.values.map((v) => ({
      key: row.district + "-" + v.place,
      district: row.district,
      place: v.place,
      value: v.value,
      y: yScale2(row.district) + innerScale(v.place),
    })),
  );

  svg2
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height2})`)
    .call(
      d3
        .axisBottom(xScale2)
        .ticks(4)
        .tickFormat(metricVar === "rate" ? (d) => d + "%" : d3.format("~s")),
    );

  const yAxis2 = svg2
    .append("g")
    .attr("class", "axis")
    .call(
      d3
        .axisLeft(yScale2)
        .tickFormat((d) => "Dist. " + d)
        .tickSize(0),
    );

  yAxis2
    .selectAll("text")
    .style("font-weight", (d) => (d === selected ? "bold" : "normal"));

  svg2
    .append("text")
    .attr("x", width2 / 2)
    .attr("y", height2 + margin2.bottom - 20)
    .attr("text-anchor", "middle")
    .text(metricVar === "rate" ? "Arrest rate" : "Incidents")
    .attr("class", "labels");

  svg2
    .append("text")
    .attr("x", -margin2.left)
    .attr("y", -margin2.top / 2)
    .style("font-weight", "bold")
    .text("Police districts, " + yearLabel())
    .attr("class", "labels");

  svg2.selectAll(".axis").style("pointer-events", "none");
}

function yearLabel() {
  return yearRange[0] === yearRange[1]
    ? yearRange[0]
    : yearRange[0] + " to " + yearRange[1];
}

function updateVis() {
  lin
    .selectAll(".lines")
    .data(series, (d) => d.place)
    .join(
      function (enter) {
        return enter
          .append("path")
          .attr("class", "lines")
          .attr("fill", "none")
          .attr("stroke", (d) => colorScale(d.place))
          .attr("stroke-width", 2.5)
          .attr("d", (d) => line(d.values));
      },
      function (update) {
        return update
          .transition()
          .duration(t)
          .attr("d", (d) => line(d.values));
      },
      function (exit) {
        exit.remove();
      },
    );

  disRow
    .selectAll(".rows")
    .data(dis, (d) => d.district)
    .join(
      function (enter) {
        return enter
          .append("rect")
          .attr("class", "rows")
          .attr("x", -margin2.left)
          .attr("width", width2 + margin2.left + margin2.right)
          .attr("y", (d) => yScale2(d.district))
          .attr("height", yScale2.bandwidth())
          .style("fill", "transparent")
          .style("cursor", "pointer")
          .on("mousemove", function (event, d) {
            d3.select("#tooltip")
              .style("display", "block")
              .html(
                `<strong>District ${d.district}</strong>` +
                  d.values
                    .map(
                      (v) =>
                        `<br/><span style="color:${colorScale(v.place)}">&#9679;</span> ${v.place}: ${d3.format(",")(v.n)} incidents, 
                ${v.n ? ((100 * v.a) / v.n).toFixed(1) : 0}% arrested`,
                    )
                    .join(""),
              )
              .style("left", event.pageX + 20 + "px")
              .style("top", event.pageY - 28 + "px");
            d3.select(this).style("fill", "rgba(0,0,0,0.05)");
          })
          .on("mouseout", function (event, d) {
            d3.select("#tooltip").style("display", "none");
            d3.select(this).style("fill", "transparent");
          })
          .on("click", function (event, d) {
            selected = selected === d.district ? null : d.district;
            updateAxes();
            updateVis();
          });
      },
      function (update) {
        return update
          .transition()
          .duration(t)
          .attr("y", (d) => yScale2(d.district))
          .attr("height", yScale2.bandwidth());
      },
      function (exit) {
        exit.remove();
      },
    );

  disBar
    .selectAll(".bars")
    .data(barData, (d) => d.key)
    .join(
      function (enter) {
        return enter
          .append("rect")
          .attr("class", "bars")
          .attr("x", 0)
          .attr("y", (d) => d.y)
          .attr("height", innerScale.bandwidth())
          .style("fill", (d) => colorScale(d.place))
          .style("opacity", (d) =>
            selected === null || d.district === selected ? 1 : 0.3,
          )
          .attr("width", 0)
          .transition()
          .duration(t)
          .attr("width", (d) => xScale2(d.value));
      },
      function (update) {
        return update
          .transition()
          .duration(t)
          .attr("y", (d) => d.y)
          .attr("height", innerScale.bandwidth())
          .attr("width", (d) => xScale2(d.value))
          .style("opacity", (d) =>
            selected === null || d.district === selected ? 1 : 0.3,
          );
      },
      function (exit) {
        exit.transition().duration(t).attr("width", 0).remove();
      },
    );

  updateSummary();
}

function updateSummary() {
  let by = d3.rollup(filterData(true, true), summarize, (d) => d.place);
  let [r, a] = places.map((p) => by.get(p) || { n: 0, a: 0 });
  let rate = (o) => (o.n ? ((100 * o.a) / o.n).toFixed(1) + "%" : "n/a");
  let where = selected === null ? "citywide" : "District " + selected;
  d3.select("#value").html(
    `<strong>${yearLabel()}, ${where}:</strong> ${d3.format(",")(r.n)} residence incidents (${rate(r)} 
        led to an arrest) compared with ${d3.format(",")(a.n)} apartment incidents (${rate(a)} led to an arrest).`,
  );
}

function addLegend() {
  let size = 10;
  svg
    .selectAll("placeSquare")
    .data(places)
    .enter()
    .append("rect")
    .attr("x", (d, i) => i * (size + 100) + 100)
    .attr("y", -margin.top / 2)
    .attr("width", size)
    .attr("height", size)
    .style("fill", (d) => colorScale(d));

  svg
    .selectAll("placeName")
    .data(places)
    .enter()
    .append("text")
    .attr("y", -margin.top / 2 + size)
    .attr("x", (d, i) => i * (size + 100) + 120)
    .text((d) => d)
    .attr("text-anchor", "start")
    .style("font-size", "13px")
    .style("fill", 'black');
}

window.addEventListener("load", init);
