// ===== Google Apps Script — полный бэкенд =====
// В настройках проекта: Time zone (например Asia/Almaty)

var TIMEZONE = "Asia/Almaty";

// ==================== HTTP ENTRYPOINTS ====================

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;

    var handlers = {
      login: login,
      verifyPassword: verifyPassword,
      getAppData: getAppData,
      getBalance: getBalance,
      updateBalance: updateBalance,
      getPreBalance: getPreBalance,
      updatePreBalance: updatePreBalance,
      transfer: transfer,
      getTransfers: getTransfers,
      getExpenses: getExpenses,
      saveExpense: saveExpense,
      updateExpense: updateExpense,
      deleteExpense: deleteExpense,
      saveMileage: saveMileage,
      getMileage: getMileage,
      getDrivers: getDrivers,
      createDriver: createDriver,
      deleteDriver: deleteDriver,
      updateDriver: updateDriver,
      updateCurrencies: updateCurrencies
    };

    if (!handlers[action]) {
      return jsonResponse({ success: false, error: "Unknown action: " + action });
    }

    return jsonResponse(handlers[action](body));
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function doGet() {
  return jsonResponse({ success: true, message: "API is running" });
}

// ==================== HELPERS: SHEETS ====================

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function getOrCreateSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length) {
      sheet.appendRow(headers);
    }
  }
  return sheet;
}

function rowToObj(headers, row) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    obj[headers[i]] = row[i] !== undefined ? row[i] : "";
  }
  return obj;
}

function formatDate(date) {
  if (!date) return "";
  if (date instanceof Date) {
    return Utilities.formatDate(date, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
  }
  return String(date);
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// ==================== AUTH ====================

function login(body) {
  var sheet = getSheet("Users");
  if (!sheet) {
    return { success: false, error: "Лист Users не найден" };
  }

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];

  for (var i = 1; i < rows.length; i++) {
    var r = rowToObj(headers, rows[i]);
    if (
      String(r.login) === String(body.login) &&
      String(r.password) === String(body.password)
    ) {
      var balances = getBalancesForUser(r.id);
      var preBalances = getPreBalancesForUser(r.id);

      return {
        success: true,
        data: {
          id: String(r.id),
          login: String(r.login),
          name: String(r.name),
          role: String(r.role || "driver").toLowerCase(),
          photo: r.photo ? String(r.photo) : undefined,
          availableCurrencies: String(r.availableCurrencies || r.currencies || ""),
          balances: balances,
          preBalances: preBalances
        }
      };
    }
  }

  return { success: false, error: "Неверный логин или пароль" };
}

function verifyPassword(body) {
  var sheet = getSheet("Users");
  if (!sheet) {
    return { success: true, data: { valid: false } };
  }

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];

  for (var i = 1; i < rows.length; i++) {
    var r = rowToObj(headers, rows[i]);
    if (
      String(r.login) === String(body.login) &&
      String(r.password) === String(body.password)
    ) {
      return { success: true, data: { valid: true } };
    }
  }
  return { success: true, data: { valid: false } };
}

// ==================== APP DATA ====================

function getAppData() {
  var sheet = getSheet("Categories");
  if (!sheet) {
    return { success: true, data: [] };
  }
  var rows = sheet.getDataRange().getValues();
  var categories = [];
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0]) categories.push(String(rows[i][0]));
  }
  return { success: true, data: categories };
}

// ==================== BALANCE ====================

function getBalancesForUser(userId) {
  var sheet = getSheet("Balances");
  if (!sheet) {
    return { KZT: 0, RUB: 0, UZS: 0, CNY: 0, EUR: 0 };
  }

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(userId)) {
      var balances = {};
      for (var c = 1; c < headers.length; c++) {
        balances[String(headers[c])] = Number(rows[i][c]) || 0;
      }
      return balances;
    }
  }
  return { KZT: 0, RUB: 0, UZS: 0, CNY: 0, EUR: 0 };
}

function getBalance(body) {
  return { success: true, data: getBalancesForUser(body.userId) };
}

function updateBalance(body) {
  var targetUserId = body.targetUserId;
  var currency = body.currency;
  var newAmount = Number(body.newAmount);

  var sheet = getSheet("Balances");
  if (!sheet) {
    sheet = getOrCreateSheet("Balances", [
      "userId", "KZT", "RUB", "UZS", "CNY", "EUR"
    ]);
  }

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colIndex = headers.indexOf(currency);

  if (colIndex === -1) {
    return { success: false, error: "Валюта не найдена: " + currency };
  }

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(targetUserId)) {
      sheet.getRange(i + 1, colIndex + 1).setValue(newAmount);
      return { success: true };
    }
  }

  var newRow = [targetUserId, 0, 0, 0, 0, 0];
  newRow[colIndex] = newAmount;
  sheet.appendRow(newRow);
  return { success: true };
}

function addToBalance(userId, currency, delta) {
  var sheet = getSheet("Balances");
  if (!sheet) {
    sheet = getOrCreateSheet("Balances", [
      "userId", "KZT", "RUB", "UZS", "CNY", "EUR"
    ]);
  }

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colIndex = headers.indexOf(currency);

  if (colIndex === -1) return;

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(userId)) {
      var current = Number(rows[i][colIndex]) || 0;
      sheet.getRange(i + 1, colIndex + 1).setValue(current + delta);
      return;
    }
  }

  var newRow = [userId, 0, 0, 0, 0, 0];
  newRow[colIndex] = delta;
  sheet.appendRow(newRow);
}

// ==================== PRE-BALANCE ====================

function getPreBalanceSheet() {
  return getOrCreateSheet("PreBalances", [
    "userId", "KZT", "RUB", "UZS", "CNY", "EUR"
  ]);
}

function getPreBalancesForUser(userId) {
  var sheet = getPreBalanceSheet();
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(userId)) {
      var balances = {};
      for (var c = 1; c < headers.length; c++) {
        balances[String(headers[c])] = Number(rows[i][c]) || 0;
      }
      return balances;
    }
  }
  return { KZT: 0, RUB: 0, UZS: 0, CNY: 0, EUR: 0 };
}

function setPreBalance(userId, currency, newAmount) {
  var sheet = getPreBalanceSheet();
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colIndex = headers.indexOf(currency);

  if (colIndex === -1) return;

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(userId)) {
      sheet.getRange(i + 1, colIndex + 1).setValue(newAmount);
      return;
    }
  }

  var newRow = [userId, 0, 0, 0, 0, 0];
  newRow[colIndex] = newAmount;
  sheet.appendRow(newRow);
}

function getPreBalance(body) {
  return { success: true, data: getPreBalancesForUser(body.userId) };
}

function updatePreBalance(body) {
  var targetUserId = body.targetUserId;
  var currency = body.currency;
  var newAmount = Number(body.newAmount);

  setPreBalance(targetUserId, currency, newAmount);
  return { success: true };
}

// ==================== TRANSFERS ====================

function getTransfersSheet() {
  return getOrCreateSheet("Transfers", [
    "id", "fromDriverId", "toDriverId", "currency", "amount", "date", "performedBy"
  ]);
}

function getDriverName(userId) {
  var sheet = getSheet("Users");
  if (!sheet) return "";
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(userId)) return String(rows[i][3] || "");
  }
  return "";
}

function transfer(body) {
  var fromDriverId = String(body.fromDriverId || "");
  var toDriverId = String(body.toDriverId || "");
  var currency = String(body.currency || "KZT");
  var amount = Number(body.amount || 0);
  var performedById = String(body.performedBy || "");

  if (!fromDriverId || !toDriverId) {
    return { success: false, error: "Не указаны водители" };
  }
  if (!(amount > 0)) {
    return { success: false, error: "Сумма должна быть > 0" };
  }

  var preFrom = getPreBalancesForUser(fromDriverId);
  var currentPre = Number(preFrom[currency]) || 0;
  if (currentPre < amount) {
    return { success: false, error: "Недостаточно средств на предбалансе" };
  }

  setPreBalance(fromDriverId, currency, currentPre - amount);
  addToBalance(toDriverId, currency, amount);

  var performerName = performedById ? getDriverName(performedById) : "";
  if (!performerName && performedById) performerName = performedById;

  var sheet = getTransfersSheet();
  var id = Utilities.getUuid();
  var date = new Date();

  sheet.appendRow([
    id,
    fromDriverId,
    toDriverId,
    currency,
    amount,
    date,
    performerName
  ]);

  return { success: true };
}

function getTransfers(body) {
  var limit = body && body.limit != null ? Math.max(0, parseInt(body.limit, 10)) : null;
  var offset = body && body.offset != null ? Math.max(0, parseInt(body.offset, 10)) : 0;
  var sinceMs = body && parseDateOrNull(body.since);
  var untilMs = body && parseDateOrNull(body.until);
  if (untilMs) {
    var u = new Date(untilMs);
    u.setHours(23, 59, 59, 999);
    untilMs = u.getTime();
  }

  var sheet = getTransfersSheet();
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var result = [];

  for (var i = 1; i < rows.length; i++) {
    var r = rowToObj(headers, rows[i]);
    var rowDate = r.date ? (r.date instanceof Date ? r.date.getTime() : new Date(r.date).getTime()) : 0;
    if (sinceMs != null && rowDate < sinceMs) continue;
    if (untilMs != null && rowDate > untilMs) continue;

    result.push({
      id: String(r.id || i),
      fromDriverId: String(r.fromDriverId || ""),
      toDriverId: String(r.toDriverId || ""),
      currency: String(r.currency || "KZT"),
      amount: Number(r.amount) || 0,
      date: formatDate(r.date),
      performedBy: String(r.performedBy || "")
    });
  }

  if (offset > 0 || limit != null) {
    var end = limit != null ? offset + limit : result.length;
    result = result.slice(offset, end);
  }

  return { success: true, data: result };
}

// ==================== EXPENSES ====================

var EXPENSES_HEADERS = [
  "id", "userId", "date", "category", "amount", "currency", "comment", "receipt_url", "performedBy"
];

/** Добавляет колонку performedBy в лист Expenses, если её ещё нет. Старые данные не трогает. */
function ensureExpensesPerformedByColumn(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers.indexOf("performedBy") !== -1) return;
  sheet.getRange(1, lastCol + 1).setValue("performedBy");
}

function parseDateOrNull(val) {
  if (!val) return null;
  var d = new Date(val);
  return isNaN(d.getTime()) ? null : d.getTime();
}

function getExpenses(body) {
  var userId = body.userId;
  var role = body.role;
  var limit = body.limit != null ? Math.max(0, parseInt(body.limit, 10)) : null;
  var offset = body.offset != null ? Math.max(0, parseInt(body.offset, 10)) : 0;
  var sinceMs = parseDateOrNull(body.since);
  var untilMs = parseDateOrNull(body.until);
  if (untilMs) {
    var u = new Date(untilMs);
    u.setHours(23, 59, 59, 999);
    untilMs = u.getTime();
  }

  var sheet = getSheet("Expenses");
  if (!sheet) {
    return { success: true, data: [] };
  }

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var expenses = [];

  for (var i = 1; i < rows.length; i++) {
    var r = rowToObj(headers, rows[i]);

    if (role !== "Admin" && String(r.userId) !== String(userId)) {
      continue;
    }
    if (role !== "Admin" && String(r.category || "") === "Пополнение") {
      continue;
    }

    var rowDate = r.date ? (r.date instanceof Date ? r.date.getTime() : new Date(r.date).getTime()) : 0;
    if (sinceMs != null && rowDate < sinceMs) continue;
    if (untilMs != null && rowDate > untilMs) continue;

    expenses.push({
      id: String(r.id || i),
      driverId: String(r.userId || ""),
      driverName: getDriverName(r.userId),
      date: formatDate(r.date),
      category: String(r.category || ""),
      amount: Number(r.amount) || 0,
      currency: String(r.currency || "KZT"),
      comment: String(r.comment || ""),
      receiptUrl: String(r.receipt_url || r.receiptUrl || ""),
      performedBy: String(r.performedBy || "")
    });
  }

  if (offset > 0 || limit != null) {
    var end = limit != null ? offset + limit : expenses.length;
    expenses = expenses.slice(offset, end);
  }

  return { success: true, data: expenses };
}

function saveExpense(body) {
  var userId = body.userId;
  var category = body.category;
  var amount = Number(body.amount);
  var currency = body.currency || "KZT";
  var comment = body.comment || "";
  var receiptUrl = body.receiptUrl || "";
  var performedByName = body.performedByName !== undefined ? String(body.performedByName) : "";

  var sheet = getSheet("Expenses");
  if (!sheet) {
    sheet = getOrCreateSheet("Expenses", EXPENSES_HEADERS);
  } else {
    ensureExpensesPerformedByColumn(sheet);
  }

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var colCount = headers.length;
  var performedByCol = headers.indexOf("performedBy") !== -1;

  var id = Utilities.getUuid();
  var date = new Date();

  var row = [id, userId, date, category, amount, currency, comment, receiptUrl];
  if (performedByCol) {
    row.push(performedByName);
  }
  sheet.appendRow(row);

  if (category !== "Пополнение") {
    addToBalance(userId, currency, -amount);
  }

  return {
    success: true,
    data: {
      id: id,
      driverId: userId,
      driverName: getDriverName(userId),
      date: formatDate(date),
      category: category,
      amount: amount,
      currency: currency,
      comment: comment,
      receiptUrl: receiptUrl,
      performedBy: performedByName
    }
  };
}

function updateExpense(body) {
  var sheet = getSheet("Expenses");
  if (!sheet) {
    return { success: false, error: "Лист Expenses не найден" };
  }

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];

  for (var i = 1; i < rows.length; i++) {
    var r = rowToObj(headers, rows[i]);
    if (String(r.id) === String(body.id)) {
      var userId = String(r.userId || "");
      var oldCategory = String(r.category || "");
      var oldAmount = Number(r.amount) || 0;
      var oldCurrency = String(r.currency || "KZT");
      var newCategory = body.category !== undefined ? String(body.category) : oldCategory;
      var newAmount = body.amount !== undefined ? Number(body.amount) : oldAmount;
      var newCurrency = body.currency !== undefined ? String(body.currency) : oldCurrency;

      if (oldCategory !== "Пополнение" && userId && oldAmount > 0) {
        addToBalance(userId, oldCurrency, oldAmount);
      }
      if (newCategory !== "Пополнение" && userId && newAmount > 0) {
        addToBalance(userId, newCurrency, -newAmount);
      }

      if (body.category !== undefined) {
        var ci = headers.indexOf("category");
        if (ci !== -1) sheet.getRange(i + 1, ci + 1).setValue(body.category);
      }
      if (body.amount !== undefined) {
        var ai = headers.indexOf("amount");
        if (ai !== -1) sheet.getRange(i + 1, ai + 1).setValue(Number(body.amount));
      }
      if (body.currency !== undefined) {
        var cui = headers.indexOf("currency");
        if (cui !== -1) sheet.getRange(i + 1, cui + 1).setValue(body.currency);
      }
      if (body.comment !== undefined) {
        var cmi = headers.indexOf("comment");
        if (cmi !== -1) sheet.getRange(i + 1, cmi + 1).setValue(body.comment);
      }
      if (body.receiptUrl !== undefined) {
        var ri = headers.indexOf("receipt_url");
        if (ri !== -1) sheet.getRange(i + 1, ri + 1).setValue(body.receiptUrl);
      }
      if (body.performedBy !== undefined) {
        var pi = headers.indexOf("performedBy");
        if (pi !== -1) sheet.getRange(i + 1, pi + 1).setValue(String(body.performedBy));
      }
      return { success: true };
    }
  }
  return { success: false, error: "Расход не найден" };
}

function deleteExpense(body) {
  var expenseId = body.expenseId;
  var sheet = getSheet("Expenses");
  if (!sheet) {
    return { success: false, error: "Лист Expenses не найден" };
  }

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(expenseId)) {
      var r = rowToObj(headers, rows[i]);
      var category = String(r.category || "");
      var amount = Number(r.amount) || 0;
      var currency = String(r.currency || "KZT");
      var userId = String(r.userId || "");

      if (category !== "Пополнение" && userId && amount > 0) {
        addToBalance(userId, currency, amount);
      }
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: "Запись не найдена" };
}

// ==================== MILEAGE ====================

function getMileage(body) {
  var userId = body && body.userId ? String(body.userId) : "";
  var limit = body && body.limit != null ? Math.max(0, parseInt(body.limit, 10)) : null;
  var offset = body && body.offset != null ? Math.max(0, parseInt(body.offset, 10)) : 0;
  var sinceMs = body && parseDateOrNull(body.since);
  var untilMs = body && parseDateOrNull(body.until);
  if (untilMs) {
    var u = new Date(untilMs);
    u.setHours(23, 59, 59, 999);
    untilMs = u.getTime();
  }

  var sheet = getSheet("Mileage");
  if (!sheet) {
    return { success: true, data: [] };
  }

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var reports = [];

  for (var i = 1; i < rows.length; i++) {
    var r = rowToObj(headers, rows[i]);
    if (!userId || String(r.userId) === userId) {
      var rowDate = r.date ? (r.date instanceof Date ? r.date.getTime() : new Date(r.date).getTime()) : 0;
      if (sinceMs != null && rowDate < sinceMs) continue;
      if (untilMs != null && rowDate > untilMs) continue;

      reports.push({
        id: String(r.id || i),
        driverId: String(r.userId || ""),
        driverName: getDriverName(r.userId),
        date: formatDate(r.date),
        km: Number(r.km_value || r.km) || 0,
        photoUrl: String(r.photo_url || r.photoUrl || "")
      });
    }
  }

  if (offset > 0 || limit != null) {
    var end = limit != null ? offset + limit : reports.length;
    reports = reports.slice(offset, end);
  }
  return { success: true, data: reports };
}

function saveMileage(body) {
  var userId = body.userId;
  var km = Number(body.km);
  var photoUrl = body.photoUrl || "";
  var sheet = getSheet("Mileage");
  if (!sheet) {
    sheet = getOrCreateSheet("Mileage", [
      "id", "userId", "date", "km_value", "photo_url"
    ]);
  }

  var id = Utilities.getUuid();
  var date = new Date();

  sheet.appendRow([id, userId, date, km, photoUrl]);

  return {
    success: true,
    data: {
      id: id,
      driverId: userId,
      driverName: getDriverName(userId),
      date: formatDate(date),
      km: km,
      photoUrl: photoUrl
    }
  };
}

// ==================== DRIVERS ====================

function getDrivers() {
  var sheet = getSheet("Users");
  if (!sheet) {
    return { success: true, data: [] };
  }

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var drivers = [];

  for (var i = 1; i < rows.length; i++) {
    var r = rowToObj(headers, rows[i]);
    if (!r.id) continue;

    var balances = getBalancesForUser(r.id);
    var preBalances = getPreBalancesForUser(r.id);

    drivers.push({
      id: String(r.id),
      login: String(r.login || ""),
      name: String(r.name || ""),
      role: String(r.role || "driver").toLowerCase(),
      photo: r.photo ? String(r.photo) : undefined,
      availableCurrencies: String(r.availableCurrencies || r.currencies || ""),
      balances: balances,
      preBalances: preBalances
    });
  }
  return { success: true, data: drivers };
}

function createDriver(body) {
  var login = body.login;
  var password = body.password;
  var name = body.name;
  var currencies = body.currencies || "";

  if (!login || !password || !name) {
    return { success: false, error: "Заполните все обязательные поля" };
  }

  var sheet = getSheet("Users");
  if (!sheet) {
    sheet = getOrCreateSheet("Users", [
      "id", "login", "password", "name", "role", "availableCurrencies"
    ]);
  }

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];

  for (var i = 1; i < rows.length; i++) {
    var r = rowToObj(headers, rows[i]);
    if (String(r.login) === String(login)) {
      return { success: false, error: "Логин уже занят" };
    }
  }

  var id = Utilities.getUuid();
  sheet.appendRow([id, login, password, name, "driver", currencies]);

  var balSheet = getOrCreateSheet("Balances", [
    "userId", "KZT", "RUB", "UZS", "CNY", "EUR"
  ]);
  balSheet.appendRow([id, 0, 0, 0, 0, 0]);

  var preSheet = getPreBalanceSheet();
  preSheet.appendRow([id, 0, 0, 0, 0, 0]);

  return {
    success: true,
    data: {
      id: id,
      login: login,
      name: name,
      role: "driver",
      availableCurrencies: currencies,
      balances: { KZT: 0, RUB: 0, UZS: 0, CNY: 0, EUR: 0 },
      preBalances: { KZT: 0, RUB: 0, UZS: 0, CNY: 0, EUR: 0 }
    }
  };
}

function updateDriver(body) {
  var userId = body.userId;
  var sheet = getSheet("Users");
  if (!sheet) {
    return { success: false, error: "Лист Users не найден" };
  }

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];

  var targetRow = -1;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(userId)) {
      targetRow = i;
      break;
    }
  }

  if (targetRow === -1) {
    return { success: false, error: "Водитель не найден" };
  }

  if (body.login !== undefined && body.login !== "") {
    var loginCol = headers.indexOf("login");
    if (loginCol === -1)
      return { success: false, error: "Колонка login не найдена" };

    for (var j = 1; j < rows.length; j++) {
      if (j === targetRow) continue;
      if (String(rows[j][loginCol]) === String(body.login)) {
        return {
          success: false,
          error: "Этот логин уже используется другим пользователем"
        };
      }
    }
    sheet.getRange(targetRow + 1, loginCol + 1).setValue(body.login);
  }

  if (body.name !== undefined && body.name !== "") {
    var nameCol = headers.indexOf("name");
    if (nameCol !== -1) sheet.getRange(targetRow + 1, nameCol + 1).setValue(body.name);
  }

  if (body.password !== undefined && body.password !== "") {
    var passCol = headers.indexOf("password");
    if (passCol !== -1) sheet.getRange(targetRow + 1, passCol + 1).setValue(body.password);
  }

  return { success: true };
}

function deleteDriver(body) {
  var userId = body.userId;
  var sheet = getSheet("Users");
  if (!sheet) {
    return { success: false, error: "Лист Users не найден" };
  }

  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(userId)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }

  return { success: true };
}

function updateCurrencies(body) {
  var targetUserId = body.targetUserId;
  var currenciesString = body.currenciesString;

  var sheet = getSheet("Users");
  if (!sheet) {
    return { success: false, error: "Лист Users не найден" };
  }

  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var col = headers.indexOf("availableCurrencies");

  if (col === -1) {
    return { success: false, error: "Колонка availableCurrencies не найдена" };
  }

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(targetUserId)) {
      sheet.getRange(i + 1, col + 1).setValue(currenciesString);
      return { success: true };
    }
  }
  return { success: false, error: "Водитель не найден" };
}
