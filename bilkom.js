window.fail = reason => {
  alert(reason);
  throw reason;
};
window.uniquePush = (array, item, alternative) => {
  if(!array.includes(item)) array.push(item);
  else if(typeof alternative !== "undefined") uniquePush(array, alternative);
  else fail("uniquePush error, array already has item: " + item);
};
window.parseDate = (dateText, timeText, savedYear) => {
  const [day, month, year] = dateText.split(".");
  if(typeof year !== "undefined") savedYear = parseInt(year);
  const [hours, minutes] = timeText.split(":");
  return [
    new Date(savedYear, parseInt(month)-1, parseInt(day), parseInt(hours), parseInt(minutes)),
    savedYear,
  ];
};
window.formatDate = date => date.toLocaleDateString("en-CA", {day:"2-digit", month: "2-digit", year: "numeric"});
window.formatTime = date => date.toLocaleTimeString("en-US", {hour:"2-digit", minute: "2-digit", hour12: false});

window.travel = [];

// parsing the travel plan
{
  // parsing headers
  const headers = [];
  const travelTable = document.querySelector(".travel-plane-table");
  for(const header of travelTable.querySelectorAll(":scope > thead > tr:first-child > td")) {
    let columns = header.getAttribute("colspan");
    if(columns === null) columns = "1";
    const headerText = header.textContent.trim();

    if(columns === "1") {
      if(headerText === "odcinek") uniquePush(headers, "stretch");
      else if(headerText === "poc.") uniquePush(headers, "trainNumber");
      else if(headerText === "kl.") uniquePush(headers, "class");
      else if(headerText === "wagon") uniquePush(headers, "carriage");
      else if(headerText === "miejsca") uniquePush(headers, "seats");
      else if(headerText === "przew.") uniquePush(headers, "carrier");
      else if(headerText === "data") uniquePush(headers, "departureDate", "arrivalDate");
      else if(headerText === "godz.") uniquePush(headers, "departureTime", "arrivalTime");
      else {
        fail("Error parsing headers - unknown header for colspan 1: " + headerText);
      }
    }
    else if(columns === "2") {
      if(headerText === "od -> do") {
        uniquePush(headers, "from");
        uniquePush(headers, "to");
      }
      else {
        fail("Error parsing headers - unknown header for colspan 2: " + headerText);
      }
    }
    else {
      fail("Error parsing headers - colspan different than 1 or 2: " + columns);
    }
  }

  // parsing travel stretches
  let savedYear = (new Date()).getFullYear();
  for(const stretchRow of travelTable.querySelectorAll(":scope > tbody > tr")) {
    const stretch = {};
    for(const [index, cell] of stretchRow.querySelectorAll(":scope > td").entries()) {
      stretch[headers[index]] = cell.textContent.trim();
    }
    // parse date and time
    [stretch.departure, savedYear] = parseDate(stretch.departureDate, stretch.departureTime, savedYear);
    [stretch.arrival, savedYear] = parseDate(stretch.arrivalDate, stretch.arrivalTime, savedYear);
    travel.push(stretch);
  };
}

// parsing tickets
{
  for(const ticket of document.querySelectorAll(".ticket")) {
    const sellers = {};
    const allSellers = Array.from(ticket.querySelectorAll(".carrier-logo"));
    const mainSeller = allSellers.shift().src;
    const code = ticket.querySelector(".qr-code > img").src;
    const ticketNumber = ticket.querySelector(".qr-code > p").textContent.trim();
    const from = ticket.querySelector(".text-left.padding-left").textContent.trim();
    const to = ticket.querySelector(".text-left.padding-left + .text-left").textContent.trim();

    if(allSellers.length > 0) {
      try {
        const sellersText = ticket.querySelector(".text-left").textContent.trim();
        if(!sellersText.startsWith("Przewoźnicy:")) throw "Multiple sellers but their names could not be found";
        const sellersArray = Array.from(sellersText.substr(12).matchAll(/\(([^\)]+)\)/g));
        if(allSellers.length !== sellersArray.length) throw "Number of seller names doesn't match number of logos";
        for(const [index, sellerLogo] of allSellers.entries()) {
          sellers[sellersArray[index][1]] = sellerLogo.src;
        }
      }
      catch(error) {
        console.warn(error);
      }
    }

    let started = false;
    for(const stretch of travel) {
      let seller = sellers[stretch.carrier];
      //seller = undefined;
      if(typeof seller === "undefined") seller = mainSeller;
      // skip stretches with assigned tickets
      if(typeof stretch.code !== "undefined") continue;
      // if a stretch hasn't started yet, make sure it matches departure on the ticket
      if(!started) {
        if(from !== stretch.from) fail("The ticket doesn't match the stretch: " + from + "/" + stretch.from);
        started = true;
      }
      // detect the last stretch of a ticket
      if(to === stretch.to) started = false;
      // add ticket info to stretch
      Object.assign(stretch, {seller, code, ticketNumber});
      // break if last stretch was found
      if(!started) break;
    }
  }
}

// display new tickets
try {
  const stylesheet = document.createElement("style");
  stylesheet.innerHTML = `
:root {
  --unit: min(1vw, calc(100vh / 207));
}
body {
  --u1: calc(1 * var(--unit));
  --u5: calc(5 * var(--unit));
  --u6: calc(6 * var(--unit));
  --u7: calc(7 * var(--unit));
  --u8: calc(8 * var(--unit));
  --u10: calc(10 * var(--unit));
  --u12: calc(12 * var(--unit));
  --u25: calc(25 * var(--unit));
  --u80: calc(80 * var(--unit));
}
html, body{
   overflow: auto;
}
body {
  margin: 0;
  padding: 0;
  background: white !important;
}

button {
  font-size: var(--u7);
  display: block;
  margin: var(--u1);
}

.better-ticket {
  width: 100vw;
  min-height: 100vh;
  text-align: center;
  font-family: "Nimbus Sans", sans-serif !important;
  background: white !important;
}
.better-ticket-inner {
  width: calc(100 * var(--unit));
  height: calc(207 * var(--unit));
  margin: 0 auto;
  position: relative;
}
.better-ticket-inner::after { /* for taking screenshots */
  content: "";
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.seller {
  height: var(--u25);
  padding: var(--u5);
}
.seller > img {
  object-fit: contain;
  height: 100%;
  width: 100%;
  max-width: var(--u80);
}
.datetime {
  font-size: var(--u7);
  line-height: var(--u7);
}
.time {
  font-weight: bold;
}
.location {
  font-size: var(--u8);
  line-height: var(--u8);
  font-weight: bold;
}
.arrow {
  width: var(--u12);
}
.train {
  font-size: var(--u7);
  line-height: var(--u7);
  padding-top: var(--u5);
}
.code {
  height: var(--u80);
  padding: var(--u5) 0;
  image-rendering: pixelated;
}
.ticket-number {
  font-size: var(--u5);
  line-height: var(--u5);
  padding-bottom: var(--u5);
}
.icon {
  max-height: var(--u6);
  vertical-align: text-top;
}
`;
  document.head.append(stylesheet);
  document.body.innerHTML = "";

  const buttons = document.createElement("div");
  document.body.append(buttons);
  {
    const button = document.createElement("button");
    button.id = "fullscreen";
    button.innerText = "Fullscreen";
    buttons.append(button);
  }

  for(const stretch of travel) {
    const ticket = document.createElement("div");
    ticket.classList.add("better-ticket");
    const carriageSeatSameLine = stretch.carriage.length + stretch.seats.length < stretch.trainNumber.length + stretch.carriage.length;
    ticket.innerHTML = `<div class="better-ticket-inner">
<div class="seller"><img src="${stretch.seller}"></div>
<div class="datetime">${formatDate(stretch.departure)},
  <span class="time">${formatTime(stretch.departure)}</span></div>
<div class="location">${stretch.from}</div>
<svg class="arrow" preserveAspectRatio="xMidYMid slice" viewBox="0 0 32 32" fill="#000000"><path d="M0.256 8.606c0-0.269 0.106-0.544 0.313-0.75 0.412-0.412 1.087-0.412 1.5 0l14.119 14.119 13.913-13.912c0.413-0.412 1.087-0.412 1.5 0s0.413 1.088 0 1.5l-14.663 14.669c-0.413 0.413-1.088 0.413-1.5 0l-14.869-14.869c-0.213-0.213-0.313-0.481-0.313-0.756z"/></svg>
<div class="datetime">${formatDate(stretch.arrival)},
  <span class="time">${formatTime(stretch.arrival)}</span></div>
<div class="location">${stretch.to}</div>
<div class="train">
<svg class="icon" preserveAspectRatio="xMidYMid slice" viewBox="0 0 512 512"><g><path fill="#000000" d="M437.575,351.629V89.868C437.575,40.233,397.351,0,347.707,0H164.293c-49.625,0-89.868,40.233-89.868,89.868 v261.761c0,37.628,27.383,68.98,63.269,75.221L81.334,512h50.11l23.132-34.961h202.867L380.574,512h50.101l-56.35-85.15 C410.201,420.601,437.575,389.257,437.575,351.629z M178.182,40.348h155.636v25.94H178.182V40.348z M131.355,124.186 c0-11.284,9.137-20.438,20.421-20.438h208.456c11.276,0,20.429,9.154,20.429,20.438v86.206c0,11.284-9.154,20.429-20.429,20.429 H151.777c-11.284,0-20.421-9.145-20.421-20.429V124.186z M150.808,374.004c-13.158,0-23.826-10.668-23.826-23.818 c0-13.167,10.668-23.836,23.826-23.836c13.159,0,23.827,10.668,23.827,23.836C174.635,363.336,163.967,374.004,150.808,374.004z M169.618,454.312l17.41-26.318h137.953l17.41,26.318H169.618z M361.201,374.004c-13.158,0-23.826-10.668-23.826-23.818 c0-13.167,10.668-23.836,23.826-23.836c13.159,0,23.827,10.668,23.827,23.836C385.028,363.336,374.36,374.004,361.201,374.004z"/></g></svg>
${stretch.trainNumber}${carriageSeatSameLine ? "<br>" : " / "}
<svg class="icon" preserveAspectRatio="xMidYMid slice" viewBox="0 3 25 19" fill="none"><path d="M2.51733 7.95556C2.51733 7.26521 3.07698 6.70557 3.76733 6.70557H21.2401C21.9305 6.70557 22.4901 7.26521 22.4901 7.95557V14.8994C22.4901 15.0374 22.3782 15.1494 22.2401 15.1494H2.76733C2.62926 15.1494 2.51733 15.0374 2.51733 14.8994V7.95556Z" fill="#000000" stroke="#000000" stroke-width="1.5"></path><path d="M15.7895 9.28418L13.7573 9.28418C13.6468 9.28418 13.5573 9.37372 13.5573 9.48418L13.5573 10.7275C13.5573 10.8379 13.6468 10.9275 13.7573 10.9275L15.7895 10.9275C15.9 10.9275 15.9895 10.8379 15.9895 10.7275L15.9895 9.48418C15.9895 9.37372 15.9 9.28418 15.7895 9.28418Z" fill="white" stroke="white"></path><path d="M11.2829 9.28418L9.25067 9.28418C9.14022 9.28418 9.05067 9.37372 9.05067 9.48418L9.05067 10.7275C9.05067 10.8379 9.14022 10.9275 9.25067 10.9275L11.2829 10.9275C11.3934 10.9275 11.4829 10.8379 11.4829 10.7275L11.4829 9.48418C11.4829 9.37372 11.3934 9.28418 11.2829 9.28418Z" fill="white" stroke="white"></path><path d="M6.77632 9.28418L4.74408 9.28418C4.63362 9.28418 4.54408 9.37372 4.54408 9.48418L4.54408 10.7275C4.54408 10.8379 4.63362 10.9275 4.74408 10.9275L6.77632 10.9275C6.88678 10.9275 6.97632 10.8379 6.97632 10.7275L6.97632 9.48418C6.97632 9.37372 6.88678 9.28418 6.77632 9.28418Z" fill="white" stroke="white"></path><path d="M4.95558 16.095C4.95558 16.5153 5.29628 16.856 5.71656 16.856C6.13684 16.856 6.47754 16.5153 6.47754 16.095C6.47754 15.6747 6.13684 15.334 5.71656 15.334C5.29628 15.334 4.95558 15.6747 4.95558 16.095Z" stroke="#000000" stroke-width="1.5"></path><path d="M14.5935 16.095C14.5935 16.5153 14.9342 16.856 15.3545 16.856C15.7748 16.856 16.1155 16.5153 16.1155 16.095C16.1155 15.6747 15.7748 15.334 15.3545 15.334C14.9342 15.334 14.5935 15.6747 14.5935 16.095Z" stroke="#000000" stroke-width="1.5"></path><path d="M8.28907 16.095C8.28907 16.5153 8.62978 16.856 9.05005 16.856C9.47033 16.856 9.81104 16.5153 9.81104 16.095C9.81104 15.6747 9.47033 15.334 9.05005 15.334C8.62978 15.334 8.28907 15.6747 8.28907 16.095Z" stroke="#000000" stroke-width="1.5"></path><path d="M17.9275 16.095C17.9275 16.5153 18.2682 16.856 18.6885 16.856C19.1088 16.856 19.4495 16.5153 19.4495 16.095C19.4495 15.6747 19.1088 15.334 18.6885 15.334C18.2682 15.334 17.9275 15.6747 17.9275 16.095Z" stroke="#000000" stroke-width="1.5"></path><path d="M15.9826 18.2935C14.0845 18.2935 11.1223 18.2935 11.1223 18.2935C11.1223 18.2935 11.1223 18.2935 11.1223 18.2935L2.48584 18.2935H22.514" stroke="#000000" stroke-width="1.5" stroke-linecap="round"></path><path d="M18.8674 14.452V9.70098C18.8674 9.59052 18.957 9.50098 19.0674 9.50098H20.1192C20.2297 9.50098 20.3192 9.59052 20.3192 9.70098V14.452" stroke="white" stroke-width="1.5"></path></svg>
${stretch.carriage}${carriageSeatSameLine ? " / " : "<br>"}
<svg class="icon" preserveAspectRatio="xMidYMid slice" viewBox="0 0 21 18" fill="none"><path d="M4.9276 13.0893H12.5222C13.0646 13.0893 13.3344 13.3811 13.3344 13.9585V15.6995H5.2062L4.9276 13.0897V13.0893ZM6.72844 11.3514L4.69949 12.4359L0 2.35156L1.49929 1.67133C1.81956 1.54436 2.07415 1.62712 2.26094 1.91546L6.72844 11.3514ZM5.58861 0.75C6.47142 0.752078 7.1866 1.51748 7.18854 2.46229C7.18854 2.95092 7.03141 3.35981 6.71749 3.68329C6.41845 4.00389 6.01079 4.18113 5.58755 4.17457C5.12852 4.17457 4.74893 4.00943 4.44384 3.68329C4.13876 3.35716 3.98834 2.95054 3.98834 2.46229C3.9805 2.00861 4.1453 1.57102 4.4449 1.24997C4.74999 0.918168 5.12922 0.75 5.58861 0.75ZM6.32343 4.33669C6.7295 4.12091 7.15888 4.09257 7.60626 4.25431C8.05365 4.41605 8.3831 4.71724 8.58401 5.15145L10.4908 9.31218H14.5282L20.5466 13.2541C21.0204 13.5776 21.1242 14.0058 20.8516 14.5288C20.5317 15.0745 20.1317 15.1712 19.6574 14.8311L15.0349 11.7859L18.6175 16.4886C18.7526 16.684 18.812 16.9277 18.7835 17.1688C18.7567 17.4228 18.6588 17.6223 18.4901 17.7652C18.0338 18.1108 17.6279 18.0749 17.2722 17.6574L12.929 11.9235H7.97385L5.56178 6.72958C5.35963 6.30753 5.33172 5.8142 5.4848 5.36913C5.63875 4.89788 5.91736 4.5555 6.32343 4.33669Z" fill="#000000"></path></svg>
${stretch.seats}</div>
<img class="code" src="${stretch.code}">
<div class="ticket-number">${stretch.ticketNumber}</div>
</div>`;
    
    document.body.append(ticket);
    const button = document.createElement("button");
    button.innerText = "Bilet " + stretch.stretch;
    button.classList.add("ticket-button");
    buttons.append(button);
  }

  const script = document.createElement("script");
  script.innerHTML = `
document.querySelector("#fullscreen").addEventListener("click", e => {
  e.preventDefault();
  document.body.requestFullscreen();
});
for(const [index, button] of Object.entries(document.querySelectorAll(".ticket-button"))) {
  button.addEventListener("click", e => {
    e.preventDefault();
    document.querySelectorAll(".better-ticket")[index].scrollIntoView();
  });
}
  `;
  document.body.append(script);
}
catch(error) {
  alert(error);
}
