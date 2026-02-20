import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type Language = "ru" | "en" | "he" | "ar";

interface TranslationEntry {
  ru: string;
  en: string;
  he: string;
  ar: string;
}

interface Translations {
  [key: string]: TranslationEntry;
}

const translations: Translations = {
  // Common
  "balance": { ru: "Баланс", en: "Balance", he: "יתרה", ar: "الرصيد" },
  "bet": { ru: "Ставка", en: "Bet", he: "הימור", ar: "رهان" },
  "min": { ru: "Мин", en: "Min", he: "מינ", ar: "الحد الأدنى" },
  "max": { ru: "Макс", en: "Max", he: "מקס", ar: "الحد الأقصى" },
  "play": { ru: "Играть", en: "Play", he: "שחק", ar: "العب" },
  "cashout": { ru: "Забрать", en: "Cash Out", he: "משיכה", ar: "سحب" },
  "win": { ru: "Победа!", en: "You Won!", he: "ניצחת!", ar: "فزت!" },
  "lose": { ru: "Проигрыш", en: "You Lost", he: "הפסדת", ar: "خسرت" },
  "draw": { ru: "Ничья!", en: "Draw!", he: "תיקו!", ar: "تعادل!" },
  "error": { ru: "Ошибка", en: "Error", he: "שגיאה", ar: "خطأ" },
  "loading": { ru: "Загрузка...", en: "Loading...", he: "טוען...", ar: "جار التحميل..." },
  "back": { ru: "Назад", en: "Back", he: "חזור", ar: "رجوع" },
  "settings": { ru: "Настройки", en: "Settings", he: "הגדרות", ar: "الإعدادات" },
  "profile": { ru: "Профиль", en: "Profile", he: "פרופיל", ar: "الملف الشخصي" },
  "wallet": { ru: "Кошелёк", en: "Wallet", he: "ארנק", ar: "المحفظة" },
  "deposit": { ru: "Пополнить", en: "Deposit", he: "הפקדה", ar: "إيداع" },
  "withdraw": { ru: "Вывести", en: "Withdraw", he: "משיכה", ar: "سحب" },
  "games": { ru: "Игры", en: "Games", he: "משחקים", ar: "الألعاب" },
  "online": { ru: "Онлайн", en: "Online", he: "מחובר", ar: "متصل" },
  "rtp": { ru: "Возврат", en: "RTP", he: "RTP", ar: "RTP" },
  "playToWin": { ru: "Играй и выигрывай", en: "Play to Win", he: "שחק ונצח", ar: "العب واربح" },
  "home": { ru: "Главная", en: "Home", he: "בית", ar: "الرئيسية" },
  "confirm": { ru: "Подтвердить", en: "Confirm", he: "אישור", ar: "تأكيد" },
  "cancel": { ru: "Отмена", en: "Cancel", he: "ביטול", ar: "إلغاء" },
  "save": { ru: "Сохранить", en: "Save", he: "שמור", ar: "حفظ" },
  "submit": { ru: "Отправить", en: "Submit", he: "שלח", ar: "إرسال" },
  "success": { ru: "Успешно", en: "Success", he: "הצלחה", ar: "نجاح" },
  "continue": { ru: "Продолжить", en: "Continue", he: "המשך", ar: "متابعة" },
  "bonus": { ru: "Бонус", en: "Bonus", he: "בונוס", ar: "مكافأة" },
  "daily": { ru: "Ежедневно", en: "Daily", he: "יומי", ar: "يومي" },
  "promo": { ru: "Промо", en: "Promo", he: "פרומו", ar: "عرض ترويجي" },
  
  // Games
  "crash": { ru: "Краш", en: "Crash", he: "קראש", ar: "كراش" },
  "blackjack": { ru: "Блэкджек", en: "Blackjack", he: "בלאק ג'ק", ar: "بلاك جاك" },
  "mines": { ru: "Мины", en: "Mines", he: "מוקשים", ar: "ألغام" },
  "dice": { ru: "Кости", en: "Dice", he: "קוביות", ar: "نرد" },
  "slots": { ru: "Слоты", en: "Slots", he: "סלוטים", ar: "سلوتس" },
  "scissors": { ru: "Камень-Ножницы-Бумага", en: "Rock Paper Scissors", he: "אבן נייר ומספריים", ar: "حجر ورقة مقص" },
  "turtle": { ru: "Черепашьи гонки", en: "Turtle Race", he: "מרוץ צבים", ar: "سباق السلاحف" },
  "poker": { ru: "Покер", en: "Poker", he: "פוקר", ar: "بوكر" },
  "aviamasters": { ru: "Авиамастерс", en: "Avia Masters", he: "אוויה מאסטרס", ar: "أفيا ماسترز" },
  
  // Game descriptions
  "crashDesc": { ru: "Выведи до краха!", en: "Cash out before crash!", he: "משוך לפני ההתרסקות!", ar: "اسحب قبل الانهيار!" },
  "blackjackDesc": { ru: "Обыграй дилера до 21!", en: "Beat the dealer to 21!", he: "נצח את הדילר עד 21!", ar: "اهزم الموزع للوصول إلى 21!" },
  "minesDesc": { ru: "Найди алмазы, избегай бомб", en: "Find gems, avoid bombs", he: "מצא יהלומים, הימנע מפצצות", ar: "ابحث عن الجواهر وتجنب القنابل" },
  "diceDesc": { ru: "Брось кости и выиграй", en: "Roll the dice, win big", he: "גלגל קוביות ונצח", ar: "ارمِ النرد واربح" },
  "slotsDesc": { ru: "Крути и выигрывай джекпот", en: "Spin to win jackpots", he: "סובב ונצח ג'קפוט", ar: "أدر واربح الجائزة الكبرى" },
  "scissorsDesc": { ru: "Классическая игра на удачу", en: "Classic game of chance", he: "משחק מזל קלאסי", ar: "لعبة حظ كلاسيكية" },
  "turtleDesc": { ru: "Ставь на победителя", en: "Bet on the winning turtle", he: "הימר על הצב המנצח", ar: "راهن على السلحفاة الفائزة" },
  "aviamastersDesc": { ru: "Лети и собирай множители", en: "Fly and collect multipliers", he: "טוס ואסוף מכפילים", ar: "طِر واجمع المضاعفات" },
  "pokerDesc": { ru: "Техасский холдем", en: "Texas Hold'em", he: "טקסס הולדם", ar: "تكساس هولدم" },
  
  // Scissors choices
  "rock": { ru: "Камень", en: "Rock", he: "אבן", ar: "حجر" },
  "paper": { ru: "Бумага", en: "Paper", he: "נייר", ar: "ورقة" },
  "scissorsChoice": { ru: "Ножницы", en: "Scissors", he: "מספריים", ar: "مقص" },
  
  // Turtle colors
  "red": { ru: "Красная", en: "Red", he: "אדום", ar: "أحمر" },
  "blue": { ru: "Синяя", en: "Blue", he: "כחול", ar: "أزرق" },
  "yellow": { ru: "Жёлтая", en: "Yellow", he: "צהוב", ar: "أصفر" },
  "green": { ru: "Зелёная", en: "Green", he: "ירוק", ar: "أخضر" },
  
  // Crash
  "placeBet": { ru: "Сделать ставку", en: "Place Bet", he: "שים הימור", ar: "ضع رهان" },
  "waitingForBets": { ru: "Ждём ставки...", en: "Waiting for bets...", he: "ממתין להימורים...", ar: "في انتظار الرهانات..." },
  "crashed": { ru: "КРАХ!", en: "CRASHED!", he: "התרסק!", ar: "تحطم!" },
  "cashedOut": { ru: "Забрано!", en: "Cashed Out!", he: "משכת!", ar: "تم السحب!" },
  "autoCashout": { ru: "Авто вывод", en: "Auto Cashout", he: "משיכה אוטומטית", ar: "سحب تلقائي" },
  "autoBet": { ru: "Авто ставка", en: "Auto Bet", he: "הימור אוטומטי", ar: "رهان تلقائي" },
  "betting": { ru: "Приём ставок", en: "Betting", he: "הימורים", ar: "مراهنات" },
  "preparing": { ru: "Подготовка", en: "Preparing", he: "מתכונן", ar: "التحضير" },
  "flying": { ru: "В полёте", en: "Flying", he: "טס", ar: "يطير" },
  
  // Blackjack
  "hit": { ru: "Ещё", en: "Hit", he: "עוד", ar: "المزيد" },
  "stand": { ru: "Хватит", en: "Stand", he: "עצור", ar: "كفى" },
  "double": { ru: "Удвоить", en: "Double", he: "כפול", ar: "مضاعفة" },
  "bust": { ru: "Перебор!", en: "Bust!", he: "פרץ!", ar: "تجاوز!" },
  "dealer": { ru: "Дилер", en: "Dealer", he: "דילר", ar: "الموزع" },
  "player": { ru: "Игрок", en: "Player", he: "שחקן", ar: "اللاعب" },
  "split": { ru: "Разделить", en: "Split", he: "פצל", ar: "تقسيم" },
  "insurance": { ru: "Страховка", en: "Insurance", he: "ביטוח", ar: "تأمين" },
  "naturalBlackjack": { ru: "Блэкджек!", en: "Blackjack!", he: "בלאק ג'ק!", ar: "بلاك جاك!" },
  
  // Mines
  "gems": { ru: "Алмазы", en: "Gems", he: "יהלומים", ar: "جواهر" },
  "bombsCount": { ru: "Бомбы", en: "Bombs", he: "פצצות", ar: "قنابل" },
  "boom": { ru: "БУМ! Вы нашли мину!", en: "BOOM! You hit a mine!", he: "בום! פגעת במוקש!", ar: "بووم! لقد ضربت لغمًا!" },
  "reveal": { ru: "Открыть", en: "Reveal", he: "גלה", ar: "كشف" },
  "tilesRevealed": { ru: "Открыто", en: "Revealed", he: "נחשפו", ar: "تم الكشف" },
  
  // Dice
  "rollOver": { ru: "Больше", en: "Roll Over", he: "מעל", ar: "أعلى من" },
  "rollUnder": { ru: "Меньше", en: "Roll Under", he: "מתחת", ar: "أقل من" },
  "target": { ru: "Цель", en: "Target", he: "מטרה", ar: "الهدف" },
  "multiplier": { ru: "Множитель", en: "Multiplier", he: "מכפיל", ar: "المضاعف" },
  "winChance": { ru: "Шанс", en: "Win Chance", he: "סיכוי", ar: "فرصة الفوز" },
  "roll": { ru: "Бросить", en: "Roll", he: "גלגל", ar: "ارمِ" },
  "result": { ru: "Результат", en: "Result", he: "תוצאה", ar: "النتيجة" },
  
  // Slots
  "spin": { ru: "Крутить", en: "Spin", he: "סובב", ar: "أدر" },
  "jackpot": { ru: "Джекпот!", en: "Jackpot!", he: "ג'קפוט!", ar: "الجائزة الكبرى!" },
  "noWin": { ru: "Не повезло", en: "No Win", he: "לא ניצחת", ar: "لا فوز" },
  "paylines": { ru: "Линии", en: "Paylines", he: "קווי תשלום", ar: "خطوط الدفع" },
  "freeSpins": { ru: "Бесплатные вращения", en: "Free Spins", he: "סיבובים חינם", ar: "دورات مجانية" },
  
  // Poker
  "fold": { ru: "Сбросить", en: "Fold", he: "פולד", ar: "انسحب" },
  "call": { ru: "Колл", en: "Call", he: "קול", ar: "مجاراة" },
  "raise": { ru: "Рейз", en: "Raise", he: "רייז", ar: "رفع" },
  "check": { ru: "Чек", en: "Check", he: "צ'ק", ar: "تمرير" },
  "allIn": { ru: "Олл-ин", en: "All In", he: "אול אין", ar: "الكل" },
  "pot": { ru: "Банк", en: "Pot", he: "קופה", ar: "القدر" },
  "blinds": { ru: "Блайнды", en: "Blinds", he: "בליינדס", ar: "الرهانات الأولية" },
  "showdown": { ru: "Вскрытие", en: "Showdown", he: "השוואה", ar: "المواجهة" },
  "cashTables": { ru: "Кэш столы", en: "Cash Tables", he: "שולחנות קאש", ar: "طاولات النقد" },
  "cashGames": { ru: "Кэш-игры", en: "Cash Games", he: "משחקי קאש", ar: "ألعاب النقد" },
  "tournamentsSoon": { ru: "Турниры скоро", en: "Tournaments Soon", he: "טורנירים בקרוב", ar: "البطولات قريبًا" },
  "sitOut": { ru: "Пропустить", en: "Sit Out", he: "לצאת", ar: "غياب" },
  "sitIn": { ru: "Вернуться", en: "Sit In", he: "לחזור", ar: "عودة" },
  "buyIn": { ru: "Бай-ин", en: "Buy-in", he: "קנייה", ar: "شراء" },
  "rebuy": { ru: "Ребай", en: "Rebuy", he: "קנייה מחדש", ar: "إعادة شراء" },
  "leaveTable": { ru: "Покинуть стол", en: "Leave Table", he: "עזוב שולחן", ar: "مغادرة الطاولة" },
  "yourTurn": { ru: "Ваш ход", en: "Your Turn", he: "התור שלך", ar: "دورك" },
  "timeRunningOut": { ru: "Время истекает!", en: "Time running out!", he: "נגמר הזמן!", ar: "الوقت ينفد!" },
  "winner": { ru: "Победитель", en: "Winner", he: "מנצח", ar: "الفائز" },
  "tables": { ru: "Столы", en: "Tables", he: "שולחנות", ar: "طاولات" },
  "playing": { ru: "ИГРАЕТЕ", en: "PLAYING", he: "משחק", ar: "يلعب" },
  
  // Profile
  "referrals": { ru: "Рефералы", en: "Referrals", he: "הפניות", ar: "الإحالات" },
  "referralCode": { ru: "Реферальный код", en: "Referral Code", he: "קוד הפניה", ar: "رمز الإحالة" },
  "generateCode": { ru: "Сгенерировать код", en: "Generate Code", he: "צור קוד", ar: "إنشاء رمز" },
  "copyCode": { ru: "Скопировать код", en: "Copy Code", he: "העתק קוד", ar: "نسخ الرمز" },
  "copied": { ru: "Скопировано!", en: "Copied!", he: "הועתק!", ar: "تم النسخ!" },
  "deleteAccount": { ru: "Удалить аккаунт", en: "Delete Account", he: "מחק חשבון", ar: "حذف الحساب" },
  "deleteConfirm": { ru: "Вы уверены? Это действие необратимо.", en: "Are you sure? This action cannot be undone.", he: "בטוח? פעולה זו לא ניתנת לביטול.", ar: "هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء." },
  "yourReferralCode": { ru: "Ваш реферальный код", en: "Your Referral Code", he: "קוד ההפניה שלך", ar: "رمز إحالتك" },
  "referralReward": { ru: "Награда за реферала", en: "Referral Reward", he: "פרס הפניה", ar: "مكافأة الإحالة" },
  "totalReferrals": { ru: "Всего рефералов", en: "Total Referrals", he: "סה״כ הפניות", ar: "إجمالي الإحالات" },
  "vipStatus": { ru: "VIP статус", en: "VIP Status", he: "סטטוס VIP", ar: "حالة VIP" },
  "vipGold": { ru: "Золотой", en: "Gold", he: "זהב", ar: "ذهبي" },
  "vipDiamond": { ru: "Бриллиантовый", en: "Diamond", he: "יהלום", ar: "ماسي" },
  "vipGodOfWin": { ru: "Бог Победы", en: "God of Win", he: "אל הניצחון", ar: "إله الفوز" },
  
  // Admin
  "adminPanel": { ru: "Панель администратора", en: "Admin Panel", he: "לוח ניהול", ar: "لوحة الإدارة" },
  "users": { ru: "Пользователи", en: "Users", he: "משתמשים", ar: "المستخدمون" },
  "withdrawals": { ru: "Выводы", en: "Withdrawals", he: "משיכות", ar: "عمليات السحب" },
  "gamesHistory": { ru: "История игр", en: "Games History", he: "היסטוריית משחקים", ar: "سجل الألعاب" },
  "promoCodes": { ru: "Промокоды", en: "Promo Codes", he: "קודי הנחה", ar: "الرموز الترويجية" },
  "tournaments": { ru: "Турниры", en: "Tournaments", he: "טורנירים", ar: "البطولات" },
  "activeUsers": { ru: "Активные пользователи", en: "Active Users", he: "משתמשים פעילים", ar: "المستخدمون النشطون" },
  "totalUsers": { ru: "Всего пользователей", en: "Total Users", he: "סה״כ משתמשים", ar: "إجمالي المستخدمين" },
  "approve": { ru: "Одобрить", en: "Approve", he: "אשר", ar: "موافقة" },
  "reject": { ru: "Отклонить", en: "Reject", he: "דחה", ar: "رفض" },
  "pending": { ru: "Ожидает", en: "Pending", he: "ממתין", ar: "قيد الانتظار" },
  "approved": { ru: "Одобрено", en: "Approved", he: "אושר", ar: "تمت الموافقة" },
  "rejected": { ru: "Отклонено", en: "Rejected", he: "נדחה", ar: "مرفوض" },
  "broadcast": { ru: "Рассылка", en: "Broadcast", he: "שידור", ar: "بث" },
  "sendMessage": { ru: "Отправить сообщение", en: "Send Message", he: "שלח הודעה", ar: "إرسال رسالة" },
  "winRate": { ru: "Процент выигрыша", en: "Win Rate", he: "אחוז ניצחון", ar: "معدل الفوز" },
  "depositAddresses": { ru: "Адреса для пополнения", en: "Deposit Addresses", he: "כתובות להפקדה", ar: "عناوين الإيداع" },
  "pokerBots": { ru: "Покер боты", en: "Poker Bots", he: "בוטים לפוקר", ar: "روبوتات البوكر" },
  "enabled": { ru: "Включено", en: "Enabled", he: "מופעל", ar: "مفعل" },
  "disabled": { ru: "Выключено", en: "Disabled", he: "מושבת", ar: "معطل" },
  "setTo": { ru: "установлен на", en: "set to", he: "מוגדר ל", ar: "تم ضبطه على" },
  "withdrawalApproved": { ru: "Вывод одобрен", en: "Withdrawal approved", he: "משיכה אושרה", ar: "تمت الموافقة على السحب" },
  "withdrawalRejected": { ru: "Вывод отклонён", en: "Withdrawal rejected", he: "משיכה נדחתה", ar: "تم رفض السحب" },
  "balanceUpdated": { ru: "Баланс обновлён", en: "Balance updated", he: "היתרה עודכנה", ar: "تم تحديث الرصيد" },
  "vipStatusUpdated": { ru: "VIP статус обновлён", en: "VIP status updated", he: "סטטוס VIP עודכן", ar: "تم تحديث حالة VIP" },
  "promoCodeCreated": { ru: "Промокод создан", en: "Promo code created", he: "קוד פרומו נוצר", ar: "تم إنشاء الرمز الترويجي" },
  "adminRightsGranted": { ru: "Права администратора выданы", en: "Admin rights granted", he: "הוענקו הרשאות מנהל", ar: "تم منح صلاحيات المسؤول" },
  "adminRightsRevoked": { ru: "Права администратора отозваны", en: "Admin rights revoked", he: "הרשאות מנהל בוטלו", ar: "تم إلغاء صلاحيات المسؤول" },
  "failedToChangeStatus": { ru: "Не удалось изменить статус", en: "Failed to change status", he: "שינוי הסטטוס נכשל", ar: "فشل تغيير الحالة" },
  "userDeleted": { ru: "Пользователь удалён", en: "User deleted", he: "המשתמש נמחק", ar: "تم حذف المستخدم" },
  "deleted": { ru: "Удалено", en: "Deleted", he: "נמחק", ar: "تم الحذف" },
  "guestAccounts": { ru: "гостевых аккаунтов", en: "guest accounts", he: "חשבונות אורח", ar: "حسابات الضيف" },
  "deleteGuests": { ru: "Удалить гостей", en: "Delete Guests", he: "מחק אורחים", ar: "حذف الضيوف" },
  "confirmDeleteGuests": { ru: "Удалить всех гостевых пользователей?", en: "Delete all guest users?", he: "למחוק את כל חשבונות האורח?", ar: "هل تريد حذف جميع المستخدمين الضيوف؟" },
  "raffleCreated": { ru: "Розыгрыш создан", en: "Raffle created", he: "ההגרלה נוצרה", ar: "تم إنشاء السحب" },
  "raffleActivated": { ru: "Розыгрыш активирован", en: "Raffle activated", he: "ההגרלה הופעלה", ar: "تم تفعيل السحب" },
  "winnersSelected": { ru: "Выбрано победителей", en: "Winners selected", he: "נבחרו מנצחים", ar: "تم اختيار الفائزين" },
  "raffleStatusUpdated": { ru: "Статус розыгрыша обновлён", en: "Raffle status updated", he: "סטטוס ההגרלה עודכן", ar: "تم تحديث حالة السحب" },
  "depositLinkUpdated": { ru: "Ссылка на депозит обновлена", en: "Deposit link updated", he: "קישור ההפקדה עודכן", ar: "تم تحديث رابط الإيداع" },
  "depositAddressesUpdated": { ru: "Адреса для пополнения обновлены", en: "Deposit addresses updated", he: "כתובות ההפקדה עודכנו", ar: "تم تحديث عناوين الإيداع" },
  "gamesDisabled": { ru: "Игры отключены", en: "Games disabled", he: "המשחקים מושבתים", ar: "تم تعطيل الألعاب" },
  "gamesEnabled": { ru: "Игры включены", en: "Games enabled", he: "המשחקים מופעלים", ar: "تم تفعيل الألعاب" },
  "messageDeleted": { ru: "Сообщение удалено", en: "Message deleted", he: "ההודעה נמחקה", ar: "تم حذف الرسالة" },
  "sent": { ru: "Отправлено", en: "Sent", he: "נשלח", ar: "تم الإرسال" },
  "errors": { ru: "Ошибок", en: "Errors", he: "שגיאות", ar: "أخطاء" },
  "pokerBotsSettingsSaved": { ru: "Настройки покер-ботов сохранены", en: "Poker bots settings saved", he: "הגדרות בוטים לפוקר נשמרו", ar: "تم حفظ إعدادات روبوتات البوكر" },
  "accessDenied": { ru: "Доступ запрещён", en: "Access Denied", he: "הגישה נדחתה", ar: "تم رفض الوصول" },
  "onlyAdminAccess": { ru: "Только администратор может получить доступ", en: "Only administrators can access this panel", he: "רק מנהלים יכולים לגשת", ar: "يمكن للمسؤولين فقط الوصول" },
  "goToHome": { ru: "На главную", en: "Go to Home", he: "לעמוד הבית", ar: "إلى الصفحة الرئيسية" },
  "notSpecified": { ru: "Не указан", en: "Not specified", he: "לא צוין", ar: "غير محدد" },
  "noBets": { ru: "Нет ставок", en: "No bets", he: "אין הימורים", ar: "لا توجد رهانات" },
  "noWithdrawals": { ru: "Нет выводов", en: "No withdrawals", he: "אין משיכות", ar: "لا توجد عمليات سحب" },
  "onlineTodayUsers": { ru: "Онлайн / Сегодня", en: "Online / Today", he: "מחוברים / היום", ar: "متصل / اليوم" },
  "noActiveUsers": { ru: "Нет активных пользователей", en: "No active users", he: "אין משתמשים פעילים", ar: "لا يوجد مستخדمون نشطون" },
  "allUsersLabel": { ru: "Все пользователи", en: "All Users", he: "כל המשתמשים", ar: "جميع المستخدمين" },
  "noUsers": { ru: "Нет пользователей", en: "No users", he: "אין משתמשים", ar: "لا يوجد مستخدمون" },
  "noWallet": { ru: "Нет кошелька", en: "No wallet", he: "אין ארנק", ar: "لا يوجد محفظة" },
  "depositLabel": { ru: "депозит", en: "deposit", he: "הפקדה", ar: "إيداع" },
  "noVip": { ru: "Нет VIP", en: "No VIP", he: "אין VIP", ar: "لا يوجد VIP" },
  "noPendingWithdrawals": { ru: "Нет ожидающих выводов", en: "No pending withdrawals", he: "אין משיכות ממתינות", ar: "لا توجد عمليات سحب معلقة" },
  "recentBets": { ru: "Последние ставки", en: "Recent Bets", he: "הימורים אחרונים", ar: "الرهانات الأخيرة" },
  "rafflesSection": { ru: "Розыгрыши", en: "Raffles", he: "הגרלות", ar: "السحوبات" },
  "prizeLabel": { ru: "Приз", en: "Prize", he: "פרס", ar: "الجائزة" },
  "winnersCount": { ru: "победитель", en: "winner", he: "מנצח", ar: "فائز" },
  "winnersCountPlural": { ru: "победителя", en: "winners", he: "מנצחים", ar: "فائزين" },
  "messageForPlayers": { ru: "Сообщение для игроков", en: "Message for players (optional)", he: "הודעה לשחקנים", ar: "رسالة للاعبين" },
  "broadcastInfo": { ru: "Поддерживает Markdown.", en: "Supports Markdown. Message will be sent to all users.", he: "תומך ב-Markdown.", ar: "يدعم Markdown." },
  "noPromoCodes": { ru: "Нет промокодов", en: "No promo codes", he: "אין קודי פרומו", ar: "لا توجد رموز ترويجية" },
  "waitForPlayers": { ru: "Ждать игроков", en: "Wait for players", he: "המתן לשחקנים", ar: "انتظار اللاعبين" },
  "youWon": { ru: "Победа!", en: "You Won!", he: "ניצחת!", ar: "فزت!" },
  "youLost": { ru: "Проигрыш", en: "You Lost", he: "הפסדת", ar: "خسرت" },
  "tie": { ru: "Ничья", en: "Tie", he: "תיקו", ar: "تعادل" },
  "betAccepted": { ru: "Ставка принята", en: "Bet accepted", he: "ההימור התקבל", ar: "تم قبول الرهان" },
  "placeBets": { ru: "Делайте ставки", en: "Place your bets", he: "הניחו את ההימורים", ar: "ضعوا رهاناتكم" },
  "launching": { ru: "Запуск через", en: "Launching in", he: "שיגור בעוד", ar: "الإطلاق في" },
  "cashoutAt": { ru: "Вывод на", en: "Cashout at", he: "משיכה ב", ar: "سحب عند" },
  "waitingNextRound": { ru: "Ожидание следующего раунда", en: "Waiting for next round", he: "ממתין לסיבוב הבא", ar: "في انتظار الجولة التالية" },
  "failedToBet": { ru: "Не удалось сделать ставку", en: "Failed to place bet", he: "ההימור נכשל", ar: "فشل الرهان" },
  "insufficientFunds": { ru: "Недостаточно средств", en: "Insufficient funds", he: "אין מספיק כספים", ar: "أموال غير كافية" },
  "noHistory": { ru: "Нет истории", en: "No history", he: "אין היסטוריה", ar: "لا يوجد سجل" },
  "over": { ru: "Больше", en: "Over", he: "מעל", ar: "فوق" },
  "under": { ru: "Меньше", en: "Under", he: "מתחת", ar: "تحت" },
  "chance": { ru: "Шанс", en: "Chance", he: "סיכוי", ar: "فرصة" },
  "rolling": { ru: "Бросаем...", en: "Rolling...", he: "מטיל...", ar: "رمي..." },
  "failedToRoll": { ru: "Не удалось бросить кости", en: "Failed to roll dice", he: "הטלת הקוביות נכשלה", ar: "فشل رمي النرد" },
  "tryAgain": { ru: "Попробуйте снова", en: "Try again", he: "נסה שוב", ar: "حاول مجددا" },
  "failedToStart": { ru: "Не удалось начать игру", en: "Failed to start game", he: "ההפעלה נכשלה", ar: "فشل بدء اللعبة" },
  "revealed": { ru: "Найдено", en: "Revealed", he: "נחשף", ar: "مكشوف" },
  "payout": { ru: "Выигрыш", en: "Payout", he: "תשלום", ar: "الدفع" },
  "playAgain": { ru: "Играть снова", en: "Play again", he: "שחק שוב", ar: "العب مجددا" },
  "start": { ru: "Старт", en: "Start", he: "התחל", ar: "بدء" },
  "cashed": { ru: "Забрано!", en: "Cashed!", he: "נמשך!", ar: "تم السحب!" },
  "dealerTurn": { ru: "Ход дилера...", en: "Dealers turn...", he: "תור הדילר...", ar: "دور الموزع..." },
  "dealing": { ru: "Раздача...", en: "Dealing...", he: "מחלק...", ar: "توزيع..." },
  "deal": { ru: "Раздать карты", en: "Deal cards", he: "חלק קלפים", ar: "وزع الأوراق" },
  "betReturned": { ru: "Ставка возвращена", en: "Bet returned", he: "ההימור הוחזר", ar: "تم إرجاع الرهان" },
  "cannotDouble": { ru: "Невозможно удвоить ставку", en: "Cannot double bet", he: "לא ניתן להכפיל", ar: "لا يمكن مضاعفة الرهان" },
  "failedToDouble": { ru: "Не удалось удвоить ставку", en: "Failed to double bet", he: "ההכפלה נכשלה", ar: "فشلت المضاعفة" },
  "bot": { ru: "Бот", en: "Bot", he: "בוט", ar: "بوت" },
  "chooseMove": { ru: "Выберите ход", en: "Choose your move", he: "בחר את המהלך שלך", ar: "اختر خطوتك" },
  "failedToPlay": { ru: "Не удалось сыграть", en: "Failed to play", he: "המשחק נכשל", ar: "فشل اللعب" },
  "redTurtle": { ru: "Красная", en: "Red", he: "אדום", ar: "أحمر" },
  "blueTurtle": { ru: "Синяя", en: "Blue", he: "כחול", ar: "أزرق" },
  "yellowTurtle": { ru: "Жёлтая", en: "Yellow", he: "צהוב", ar: "أصفر" },
  "yourTurtleWon": { ru: "Твоя черепаха победила!", en: "Your turtle won!", he: "הצב שלך ניצח!", ar: "فازت سلحفاتك!" },
  "chooseTurtle": { ru: "Выберите черепаху", en: "Choose turtle", he: "בחר צב", ar: "اختر سلحفاة" },
  "turtleWon": { ru: "черепаха победила!", en: "turtle won!", he: "הצב ניצח!", ar: "فازت السلحفاة!" },
  "racing": { ru: "Гонка...", en: "Racing...", he: "במירוץ...", ar: "سباق..." },
  "failedToRace": { ru: "Не удалось начать гонку", en: "Failed to start race", he: "המירוץ נכשל", ar: "فشل بدء السباق" },
  "crashTitle": { ru: "Краш", en: "Crash", he: "קראש", ar: "كراش" },
  "diceTitle": { ru: "Кости", en: "Dice", he: "קוביות", ar: "نرد" },
  "minesTitle": { ru: "Мины", en: "Mines", he: "מוקשים", ar: "ألغام" },
  "blackjackTitle": { ru: "Блэкджек", en: "Blackjack", he: "בלאק ג׳ק", ar: "بلاك جاك" },
  "scissorsTitle": { ru: "Камень-Ножницы-Бумага", en: "Rock Paper Scissors", he: "אבן נייר ומספריים", ar: "حجر ورقة مقص" },
  "turtleTitle": { ru: "Черепашьи гонки", en: "Turtle Race", he: "מירוץ צבים", ar: "سباق السلاحف" },
  "botAlex": { ru: "Бот 1 - Алекс", en: "Bot 1 - Alex", he: "בוט 1 - אלכס", ar: "بوت 1 - أليكس" },
  "botVictor": { ru: "Бот 2 - Виктор", en: "Bot 2 - Victor", he: "בוט 2 - ויקטור", ar: "بوت 2 - فيكتور" },
  "botMaria": { ru: "Бот 3 - Мария", en: "Bot 3 - Maria", he: "בוט 3 - מריה", ar: "بوت 3 - ماريا" },
  "aggressive": { ru: "Агрессивный", en: "Aggressive", he: "אגרסיבי", ar: "عدواني" },
  "tight": { ru: "Тайтовый", en: "Tight", he: "הדוק", ar: "ضيق" },
  "balanced": { ru: "Сбалансированный", en: "Balanced", he: "מאוזן", ar: "متوازن" },
  "saveBotSettings": { ru: "Сохранить настройки ботов", en: "Save bot settings", he: "שמור הגדרות בוטים", ar: "حفظ إعدادات الروبوتات" },
  "botsAutoJoin": { ru: "Боты автоматически присоединяются к столам", en: "Bots automatically join tables", he: "הבוטים מצטרפים אוטומטית לשולחנות", ar: "الروبوتات تنضم تلقائيًا للطاولات" },
  "broadcastMessages": { ru: "Рассылка сообщений", en: "Broadcast messages", he: "שידור הודעות", ar: "رسائل البث" },
  "attachMoneyPhoto": { ru: "Прикрепить фото", en: "Attach photo", he: "צרף תמונה", ar: "إرفاق صورة" },
  "sendToAll": { ru: "Отправить всем", en: "Send to all", he: "שלח לכולם", ar: "إرسال للجميع" },
  "broadcastNote": { ru: "Сообщение будет отправлено всем", en: "Message will be sent to everyone", he: "ההודעה תישלח לכולם", ar: "سيتم إرسال الرسالة للجميع" },
  "chatModeration": { ru: "Модерация чата", en: "Chat moderation", he: "מודרציית צאט", ar: "إشراف الدردشة" },
  "messagesCount": { ru: "сообщений", en: "messages", he: "הודעות", ar: "رسائل" },
  "noMessages": { ru: "Нет сообщений", en: "No messages", he: "אין הודעות", ar: "لا توجد رسائل" },
  "withdrawalRequests": { ru: "Запросы на вывод", en: "Withdrawal Requests", he: "בקשות משיכה", ar: "طلبات السحب" },
  "noRaffles": { ru: "Нет розыгрышей", en: "No raffles", he: "אין הגרלות", ar: "لا توجد سحوبات" },
  "namePlaceholder": { ru: "Название", en: "Name", he: "שם", ar: "الاسم" },
  "prizePlaceholder": { ru: "Приз", en: "Prize", he: "פרס", ar: "الجائزة" },
  "forAll": { ru: "Для всех", en: "For all", he: "לכולם", ar: "للجميع" },
  "participants": { ru: "участников", en: "participants", he: "משתתפים", ar: "مشاركين" },
  "statusDraft": { ru: "Черновик", en: "Draft", he: "טיוטה", ar: "مسودة" },
  "statusActive": { ru: "Идёт", en: "Active", he: "פעיל", ar: "نشط" },
  "statusCompleted": { ru: "Завершён", en: "Completed", he: "הושלם", ar: "مكتمل" },
  "statusSpinning": { ru: "Крутим...", en: "Spinning...", he: "מסתובב...", ar: "يدور..." },
  "statusCancelled": { ru: "Отменён", en: "Cancelled", he: "בוטל", ar: "ملغى" },
  "codePlaceholder": { ru: "Код", en: "Code", he: "קוד", ar: "الرمز" },
  "bonusPlaceholder": { ru: "Бонус", en: "Bonus", he: "בונוס", ar: "مكافأة" },
  "limitPlaceholder": { ru: "Лимит", en: "Limit", he: "גבול", ar: "الحد" },
  "activeStatus": { ru: "Активен", en: "Active", he: "פעיל", ar: "نشط" },
  "offStatus": { ru: "Выкл", en: "Off", he: "כבוי", ar: "إيقاف" },
  "settingsSection": { ru: "Настройки", en: "Settings", he: "הגדרות", ar: "الإعدادات" },
  "saveButton": { ru: "Сохранить", en: "Save", he: "שמור", ar: "حفظ" },
  "rtpDescription": { ru: "RTP определяет возврат игрокам", en: "RTP determines return to players", he: "RTP קובע את ההחזר לשחקנים", ar: "RTP يحدد العائد للاعبين" },
  "highIncome": { ru: "Высокий доход", en: "High income", he: "הכנסה גבוהה", ar: "دخل مرتفع" },
  "standard": { ru: "Стандарт", en: "Standard", he: "סטנדרטי", ar: "قياسي" },
  "generous": { ru: "Щедрый", en: "Generous", he: "נדיב", ar: "سخي" },
  "luxeRtpNote": { ru: "Отдельный RTP для The Luxe", en: "Separate RTP for The Luxe slot", he: "RTP נפרד לסלוט The Luxe", ar: "RTP منفصل لسلوت The Luxe" },
  "depositLinkSection": { ru: "Ссылка на депозит", en: "Deposit Link", he: "קישור הפקדה", ar: "رابط الإيداع" },
  "depositLinkNote": { ru: "Ссылка для кнопки Пополнить", en: "Link for Deposit button", he: "קישור לכפתור הפקדה", ar: "رابط زر الإيداع" },
  "depositAddressesSection": { ru: "Адреса для пополнения", en: "Deposit Addresses", he: "כתובות הפקדה", ar: "عناوين الإيداع" },
  "saveAddresses": { ru: "Сохранить адреса", en: "Save addresses", he: "שמור כתובות", ar: "حفظ العناوين" },
  "addressesNote": { ru: "Адреса для пополнения баланса", en: "Addresses for balance deposits", he: "כתובות להפקדות", ar: "عناوين للإيداعات" },
  "disableGamesTemp": { ru: "Временно отключить игры", en: "Temporarily disable games", he: "השבת משחקים זמנית", ar: "تعطيل الألعاب مؤقتًا" },
  "gamesDisabledLabel": { ru: "Игры ОТКЛЮЧЕНЫ", en: "Games DISABLED", he: "משחקים מושבתים", ar: "الألعاب معطلة" },
  "gamesEnabledLabel": { ru: "Игры включены", en: "Games enabled", he: "משחקים מופעלים", ar: "الألعاب مفعلة" },
  "updateMessage": { ru: "Обновить сообщение", en: "Update message", he: "עדכן הודעה", ar: "تحديث الرسالة" },
  "disableGamesNote": { ru: "Игроки не смогут делать ставки", en: "Players cannot place bets", he: "שחקנים לא יכולים להמר", ar: "لا يمكن للاعبين المراهنة" },
  "pokerBotsSection": { ru: "Покер Боты", en: "Poker Bots", he: "בוטים לפוקר", ar: "روبوتات البوكر" },
  "enableBots": { ru: "Включить ботов", en: "Enable bots", he: "הפעל בוטים", ar: "تفعيل الروبوتات" },
  "onLabel": { ru: "ВКЛ", en: "ON", he: "פעיל", ar: "تشغيل" },
  "offLabel": { ru: "ВЫКЛ", en: "OFF", he: "כבוי", ar: "إيقاف" },
  "joinMode": { ru: "Режим присоединения", en: "Join mode", he: "מצב הצטרפות", ar: "وضع الانضمام" },
  "joinActive": { ru: "Присоединяться", en: "Join active", he: "הצטרף לפעילים", ar: "الانضمام للنشطين" },
  "deleteUserConfirm": { ru: "Удалить пользователя", en: "Delete user", he: "מחק משתמש", ar: "حذف المستخدم" },
  
  // Wallet
  "walletAddress": { ru: "Адрес кошелька", en: "Wallet Address", he: "כתובת ארנק", ar: "عنوان المحفظة" },
  "amount": { ru: "Сумма", en: "Amount", he: "סכום", ar: "المبلغ" },
  "network": { ru: "Сеть", en: "Network", he: "רשת", ar: "الشبكة" },
  "status": { ru: "Статус", en: "Status", he: "סטטוס", ar: "الحالة" },
  "withdrawRequest": { ru: "Запрос на вывод", en: "Withdrawal Request", he: "בקשת משיכה", ar: "طلب السحب" },
  "depositAddress": { ru: "Адрес для пополнения", en: "Deposit Address", he: "כתובת להפקדה", ar: "عنوان الإيداع" },
  "yourBalance": { ru: "Ваш баланс", en: "Your Balance", he: "היתרה שלך", ar: "رصيدك" },
  "enterAmount": { ru: "Введите сумму", en: "Enter Amount", he: "הכנס סכום", ar: "أدخل المبلغ" },
  "enterAddress": { ru: "Введите адрес", en: "Enter Address", he: "הכנס כתובת", ar: "أدخل العنوان" },
  "selectNetwork": { ru: "Выберите сеть", en: "Select Network", he: "בחר רשת", ar: "اختر الشبكة" },
  "minWithdraw": { ru: "Минимальный вывод", en: "Minimum Withdrawal", he: "משיכה מינימלית", ar: "الحد الأدنى للسحب" },
  "processingTime": { ru: "Время обработки", en: "Processing Time", he: "זמן עיבוד", ar: "وقت المعالجة" },
  "transactionHistory": { ru: "История транзакций", en: "Transaction History", he: "היסטוריית עסקאות", ar: "سجل المعاملات" },
  "noTransactions": { ru: "Нет транзакций", en: "No transactions", he: "אין עסקאות", ar: "لا توجد معاملات" },
  "copyAddress": { ru: "Скопировать адрес", en: "Copy Address", he: "העתק כתובת", ar: "نسخ العنوان" },
  "depositInstructions": { ru: "Инструкция по пополнению", en: "Deposit Instructions", he: "הוראות הפקדה", ar: "تعليمات الإيداع" },
  "sendCrypto": { ru: "Отправьте криптовалюту", en: "Send cryptocurrency", he: "שלח מטבע קריפטו", ar: "أرسل العملة المشفرة" },
  "scanQR": { ru: "Сканируйте QR код", en: "Scan QR Code", he: "סרוק קוד QR", ar: "امسح رمز QR" },
  "promoCode": { ru: "Промокод", en: "Promo Code", he: "קוד פרומו", ar: "الرمز الترويجي" },
  "enterPromoCode": { ru: "Введите промокод", en: "Enter promo code", he: "הכנס קוד פרומו", ar: "أدخل الرمز الترويجي" },
  "apply": { ru: "Применить", en: "Apply", he: "החל", ar: "تطبيق" },
  "promoApplied": { ru: "Промокод применён!", en: "Promo code applied!", he: "קוד פרומו הוחל!", ar: "تم تطبيق الرمز!" },
  "invalidPromo": { ru: "Неверный промокод", en: "Invalid promo code", he: "קוד פרומו לא תקף", ar: "رمز غير صالح" },
  "withdrawRequests": { ru: "Заявки на вывод", en: "Withdrawal Requests", he: "בקשות משיכה", ar: "طلبات السحب" },
  "noActiveRequests": { ru: "Нет активных заявок", en: "No active requests", he: "אין בקשות פעילות", ar: "لا توجد طلبات نشطة" },
  "user": { ru: "Пользователь", en: "User", he: "משתמש", ar: "مستخدم" },
  "withdrawAddress": { ru: "Адрес вывода", en: "Withdrawal address", he: "כתובת משיכה", ar: "عنوان السحب" },
  "createdAt": { ru: "Создано", en: "Created", he: "נוצר", ar: "تم الإنشاء" },
  "depositBalance": { ru: "Пополнение баланса", en: "Deposit Balance", he: "הפקדת יתרה", ar: "إيداع الرصيد" },
  "sendCryptoToAddress": { ru: "Отправьте криптовалюту на один из адресов для пополнения", en: "Send cryptocurrency to one of the addresses to deposit", he: "שלח מטבע קריפטו לאחת הכתובות להפקדה", ar: "أرسل العملة المشفرة إلى أحد العناوين للإيداع" },
  "importantNote": { ru: "Важно", en: "Important", he: "חשוב", ar: "مهم" },
  "depositStep1": { ru: "Выберите нужную сеть и отправьте криптовалюту", en: "Choose network and send cryptocurrency", he: "בחר רשת ושלח מטבע קריפטו", ar: "اختر الشبكة وأرسل العملة المشفرة" },
  "depositStep2": { ru: "Укажите ваш Telegram ID в комментарии к переводу", en: "Include your Telegram ID in the transfer comment", he: "הוסף את מזהה הטלגרם שלך בהערת ההעברה", ar: "أضف معرف Telegram الخاص بك في تعليق التحويل" },
  "depositStep3": { ru: "Баланс будет пополнен в течение 5-10 минут", en: "Balance will be credited within 5-10 minutes", he: "היתרה תזוכה תוך 5-10 דקות", ar: "سيتم إضافة الرصيد خلال 5-10 دقائق" },
  "depositStep4": { ru: "Минимальная сумма: 1 USDT", en: "Minimum amount: 1 USDT", he: "סכום מינימלי: 1 USDT", ar: "الحد الأدنى للمبلغ: 1 USDT" },
  "activatePromo": { ru: "Активировать промокод", en: "Activate Promo Code", he: "הפעל קוד פרומו", ar: "تفعيل الرمز الترويجي" },
  "enterPromoForBonus": { ru: "Введите промокод для получения бонуса на баланс", en: "Enter a promo code to receive a bonus on your balance", he: "הכנס קוד פרומו לקבלת בונוס על היתרה", ar: "أدخل رمزًا ترويجيًا للحصول على مكافأة على رصيدك" },
  "activate": { ru: "Активировать", en: "Activate", he: "הפעל", ar: "تفعيل" },
  "promoFromAdmin": { ru: "Промокоды можно получить от администратора или по реферальной программе", en: "Promo codes can be obtained from administrator or referral program", he: "ניתן לקבל קודי פרומו מהמנהל או מתוכנית ההפניות", ar: "يمكن الحصول على الرموز الترويجية من المسؤول أو برنامج الإحالة" },
  "withdrawFunds": { ru: "Вывод средств", en: "Withdraw Funds", he: "משיכת כספים", ar: "سحب الأموال" },
  "selectNetworkAndAddress": { ru: "Выберите сеть, укажите адрес кошелька и сумму", en: "Select network, enter wallet address and amount", he: "בחר רשת, הכנס כתובת ארנק וסכום", ar: "اختر الشبكة، أدخل عنوان المحفظة والمبلغ" },
  "withdrawNetwork": { ru: "Сеть вывода", en: "Withdrawal Network", he: "רשת משיכה", ar: "شبكة السحب" },
  "walletAddressPlaceholder": { ru: "Адрес кошелька", en: "Wallet address", he: "כתובת ארנק", ar: "عنوان المحفظة" },
  "amountUsdt": { ru: "Сумма USDT", en: "Amount USDT", he: "סכום USDT", ar: "المبلغ USDT" },
  "availableBalance": { ru: "Доступно", en: "Available", he: "זמין", ar: "متاح" },
  "minimumUsdt": { ru: "Минимум", en: "Minimum", he: "מינימום", ar: "الحد الأدنى" },
  "withdrawConditions": { ru: "Условия вывода", en: "Withdrawal Conditions", he: "תנאי משיכה", ar: "شروط السحب" },
  "minWithdrawAmount": { ru: "Минимальная сумма: 10 USDT", en: "Minimum amount: 10 USDT", he: "סכום מינימלי: 10 USDT", ar: "الحد الأدنى للمبلغ: 10 USDT" },
  "minBetsRequired": { ru: "Требуется сделать ставок минимум на $20", en: "Minimum $20 in bets required", he: "נדרש מינימום $20 בהימורים", ar: "مطلوب حد أدنى 20 دولار في الرهانات" },
  "processingTime1to2": { ru: "Время обработки: 1-2 рабочих дня", en: "Processing time: 1-2 business days", he: "זמן עיבוד: 1-2 ימי עסקים", ar: "وقت المعالجة: 1-2 أيام عمل" },
  "withdrawalHistory": { ru: "История выводов", en: "Withdrawal History", he: "היסטוריית משיכות", ar: "سجل عمليات السحب" },
  "referralProgram": { ru: "Реферальная программа", en: "Referral Program", he: "תוכנית הפניות", ar: "برنامج الإحالة" },
  "referralProgramDesc": { ru: "Приглашайте друзей и получайте 100 ⭐ Stars! Ваш друг получит 50 ⭐ Stars!", en: "Invite friends and get 100 ⭐ Stars! Your friend gets 50 ⭐ Stars!", he: "הזמן חברים וקבל 100 ⭐ Stars! החבר שלך מקבל 50 ⭐ Stars!", ar: "ادعُ أصدقاء واحصل على 100 ⭐ Stars! صديقك يحصل على 50 ⭐ Stars!" },
  
  // Game help
  "howToPlay": { ru: "Как играть", en: "How to Play", he: "איך משחקים", ar: "كيف تلعب" },
  "rules": { ru: "Правила", en: "Rules", he: "חוקים", ar: "القواعد" },
  "close": { ru: "Закрыть", en: "Close", he: "סגור", ar: "إغلاق" },
  "help": { ru: "Помощь", en: "Help", he: "עזרה", ar: "مساعدة" },
  "info": { ru: "Информация", en: "Info", he: "מידע", ar: "معلومات" },
  
  // Tournaments / Raffles
  "tournament": { ru: "Турнир", en: "Tournament", he: "טורניר", ar: "بطولة" },
  "leaderboard": { ru: "Таблица лидеров", en: "Leaderboard", he: "לוח מובילים", ar: "قائمة المتصدرين" },
  "prize": { ru: "Приз", en: "Prize", he: "פרס", ar: "الجائزة" },
  "position": { ru: "Место", en: "Position", he: "מיקום", ar: "المركز" },
  "endsIn": { ru: "Заканчивается через", en: "Ends in", he: "מסתיים בעוד", ar: "ينتهي في" },
  "join": { ru: "Участвовать", en: "Join", he: "הצטרף", ar: "انضم" },
  "joined": { ru: "Вы участвуете", en: "Joined", he: "הצטרפת", ar: "انضممت" },
  "raffle": { ru: "Розыгрыш", en: "Raffle", he: "הגרלה", ar: "السحب" },
  "raffles": { ru: "Розыгрыши", en: "Raffles", he: "הגרלות", ar: "السحوبات" },
  "winners": { ru: "Победители", en: "Winners", he: "מנצחים", ar: "الفائزون" },
  "enterRaffle": { ru: "Участвовать", en: "Enter Raffle", he: "השתתף בהגרלה", ar: "ادخل السحب" },
  "alreadyEntered": { ru: "Вы уже участвуете", en: "Already entered", he: "כבר נרשמת", ar: "مسجل بالفعل" },
  "raffleEnded": { ru: "Розыгрыш завершён", en: "Raffle ended", he: "ההגרלה הסתיימה", ar: "انتهى السحب" },
  "selectingWinners": { ru: "Выбираем победителей", en: "Selecting winners", he: "בוחרים מנצחים", ar: "اختيار الفائزين" },
  
  // Daily Wheel
  "dailyWheel": { ru: "Колесо удачи", en: "Lucky Wheel", he: "גלגל המזל", ar: "عجلة الحظ" },
  "spinWheel": { ru: "Крутить колесо", en: "Spin Wheel", he: "סובב גלגל", ar: "أدر العجلة" },
  "nextSpinIn": { ru: "Следующее вращение через", en: "Next spin in", he: "הסיבוב הבא בעוד", ar: "الدورة التالية في" },
  "congratulations": { ru: "Поздравляем!", en: "Congratulations!", he: "מזל טוב!", ar: "تهانينا!" },
  "tryAgainTomorrow": { ru: "Попробуйте завтра", en: "Try again tomorrow", he: "נסה שוב מחר", ar: "حاول مرة أخرى غدًا" },
  
  // VIP Chat
  "vipChat": { ru: "VIP Чат", en: "VIP Chat", he: "צ'אט VIP", ar: "دردشة VIP" },
  "typeMessage": { ru: "Введите сообщение...", en: "Type a message...", he: "הקלד הודעה...", ar: "اكتب رسالة..." },
  "vipRequired": { ru: "Требуется VIP статус", en: "VIP status required", he: "נדרש סטטוס VIP", ar: "مطلوب حالة VIP" },
  "upgradeToVip": { ru: "Станьте VIP", en: "Upgrade to VIP", he: "שדרג ל-VIP", ar: "ترقية إلى VIP" },
  
  // Messages
  "betPlaced": { ru: "Ставка сделана", en: "Bet placed", he: "הימור הושם", ar: "تم وضع الرهان" },
  "insufficientBalance": { ru: "Недостаточно средств", en: "Insufficient balance", he: "יתרה לא מספקת", ar: "رصيد غير كافٍ" },
  "gameInProgress": { ru: "Игра идёт", en: "Game in progress", he: "משחק בתהליך", ar: "اللعبة جارية" },
  "waitingForPlayers": { ru: "Ожидание игроков", en: "Waiting for players", he: "ממתין לשחקנים", ar: "في انتظار اللاعبين" },
  "connectionLost": { ru: "Соединение потеряно", en: "Connection lost", he: "חיבור אבד", ar: "فقد الاتصال" },
  "reconnecting": { ru: "Переподключение...", en: "Reconnecting...", he: "מתחבר מחדש...", ar: "إعادة الاتصال..." },
  
  // Time
  "hours": { ru: "ч", en: "h", he: "ש", ar: "س" },
  "minutes": { ru: "мин", en: "min", he: "ד", ar: "د" },
  "seconds": { ru: "сек", en: "sec", he: "שנ", ar: "ث" },
  "days": { ru: "дней", en: "days", he: "ימים", ar: "أيام" },
  
  // Avia Masters
  "height": { ru: "Высота", en: "Height", he: "גובה", ar: "الارتفاع" },
  "distance": { ru: "Расстояние", en: "Distance", he: "מרחק", ar: "المسافة" },
  "speed": { ru: "Скорость", en: "Speed", he: "מהירות", ar: "السرعة" },
  "land": { ru: "Приземлиться", en: "Land", he: "נחיתה", ar: "هبوط" },
  "takeoff": { ru: "Взлёт", en: "Takeoff", he: "המראה", ar: "إقلاع" },
  "aviacrashed": { ru: "Разбился", en: "Crashed", he: "התרסק", ar: "تحطم" },
  "landed": { ru: "Приземлился", en: "Landed", he: "נחת", ar: "هبط" },
  "collectBonus": { ru: "Собрать бонус", en: "Collect bonus", he: "אסוף בונוס", ar: "اجمع المكافأة" },
  
  // Navigation
  
  // Coming Soon
  "comingSoon": { ru: "Скоро", en: "Coming Soon", he: "בקרוב", ar: "قريبًا" },
  "inDevelopment": { ru: "В разработке", en: "In Development", he: "בפיתוח", ar: "قيد التطوير" },
  
  // Poker Reactions
  "reactionBad": { ru: "Плохо", en: "Bad", he: "רע", ar: "سيء" },
  "reactionGood": { ru: "Хорошо", en: "Good", he: "טוב", ar: "جيد" },
  "reactionFire": { ru: "Огонь", en: "Fire", he: "אש", ar: "نار" },
  "reactionLike": { ru: "Лайк", en: "Like", he: "לייק", ar: "إعجاب" },
  "reactionWow": { ru: "Вау", en: "Wow", he: "וואו", ar: "واو" },
  "reactionTrophy": { ru: "Победа", en: "Victory", he: "ניצחון", ar: "نصر" },
  "reactionZap": { ru: "Удар", en: "Zap", he: "מכה", ar: "صدمة" },
  "reactionTime": { ru: "Время", en: "Time", he: "זמן", ar: "وقت" },
  "reactionLuck": { ru: "Удача", en: "Luck", he: "מזל", ar: "حظ" },
  "reactionStop": { ru: "Стоп", en: "Stop", he: "עצור", ar: "توقف" },
  
  // Poker Table UI
  "removedFromTable": { ru: "Вы были удалены со стола", en: "You were removed from the table", he: "הורחקת מהשולחן", ar: "تمت إزالتك من الطاولة" },
  "notAtTable": { ru: "Вы не за столом", en: "You are not at the table", he: "אתה לא בשולחן", ar: "أنت لست على الطاولة" },
  "userNotLoaded": { ru: "Ошибка: пользователь не загружен", en: "Error: user not loaded", he: "שגיאה: המשתמש לא נטען", ar: "خطأ: لم يتم تحميل المستخدم" },
  "rebuySuccess": { ru: "Докупка успешна", en: "Rebuy successful", he: "רכישה מחדש הצליחה", ar: "إعادة الشراء ناجحة" },
  "rebuyError": { ru: "Ошибка докупки", en: "Rebuy error", he: "שגיאת רכישה מחדש", ar: "خطأ إعادة الشراء" },
  "alreadySeated": { ru: "Вы уже сидите за столом", en: "You are already seated", he: "אתה כבר יושב", ar: "أنت جالس بالفعل" },
  "waitLoading": { ru: "Подождите загрузки...", en: "Please wait...", he: "אנא המתן...", ar: "يرجى الانتظار..." },
  "seatTaken": { ru: "Место занято", en: "Seat is taken", he: "המקום תפוס", ar: "المقعد مشغول" },
  "selectSeat": { ru: "Выберите место", en: "Select a seat", he: "בחר מקום", ar: "اختر مقعدًا" },
  "couldNotSit": { ru: "Не удалось сесть за стол", en: "Could not sit at table", he: "לא ניתן לשבת בשולחן", ar: "لا يمكن الجلوس على الطاولة" },
  "waitForHand": { ru: "Дождитесь окончания раздачи", en: "Wait for hand to end", he: "המתן לסיום היד", ar: "انتظر انتهاء التوزيع" },
  "leftTable": { ru: "Вы встали из-за стола", en: "You left the table", he: "עזבת את השולחן", ar: "غادرت الطاولة" },
  "errorLeaving": { ru: "Ошибка при выходе", en: "Error leaving", he: "שגיאה ביציאה", ar: "خطأ في المغادرة" },
  "autoFoldSitOut": { ru: "Авто-фолд + sit out", en: "Auto-fold + sit out", he: "פולד אוטומטי + יציאה", ar: "طي تلقائي + خروج" },
  "clickEmptySeat": { ru: "Нажмите на свободное место чтобы сесть", en: "Click an empty seat to sit down", he: "לחץ על מקום פנוי לשבת", ar: "انقر على مقعد فارغ للجلوس" },
  "yourStack": { ru: "Ваш стек", en: "Your stack", he: "הסטאק שלך", ar: "رصيدك" },
  "skipping": { ru: "Пропуск", en: "Skipping", he: "מדלג", ar: "تخطي" },
  "standUp": { ru: "Встать", en: "Stand Up", he: "קום", ar: "قف" },
  "seatNumber": { ru: "Место", en: "Seat", he: "מקום", ar: "مقعد" },
  "chooseBuyIn": { ru: "Выберите сумму бай-ина", en: "Choose buy-in amount", he: "בחר סכום קנייה", ar: "اختر مبلغ الشراء" },
  "sitDown": { ru: "Сесть", en: "Sit Down", he: "שב", ar: "اجلس" },
  "runItTwice": { ru: "Оба игрока All-In! Выберите количество бордов", en: "Both players All-In! Choose number of boards", he: "שני שחקנים אול-אין! בחר מספר לוחות", ar: "كلا اللاعبين All-In! اختر عدد اللوحات" },
  "playingBoards": { ru: "Играем борда", en: "Playing boards", he: "משחקים לוחות", ar: "نلعب لوحات" },
  "dealingCards": { ru: "Раздаём карты...", en: "Dealing cards...", he: "מחלק קלפים...", ar: "توزيع البطاقات..." },
  "board1": { ru: "Борд 1", en: "Board 1", he: "לוח 1", ar: "لوحة 1" },
  "board2": { ru: "Борд 2", en: "Board 2", he: "לוח 2", ar: "لوحة 2" },
  "youChose": { ru: "Вы выбрали", en: "You chose", he: "בחרת", ar: "اخترت" },
  "boardSingular": { ru: "борд", en: "board", he: "לוח", ar: "لوحة" },
  "boardsPlural": { ru: "борда", en: "boards", he: "לוחות", ar: "لوحات" },
  "waitingOpponent": { ru: "Ожидание оппонента...", en: "Waiting for opponent...", he: "ממתין ליריב...", ar: "في انتظار الخصم..." },
  "showCards": { ru: "Показать карты", en: "Show Cards", he: "הראה קלפים", ar: "أظهر البطاقات" },
  "nextHandIn": { ru: "Следующая раздача через", en: "Next hand in", he: "היד הבאה בעוד", ar: "التوزيع التالي في" },
  "rebuyTitle": { ru: "Докупка", en: "Rebuy", he: "רכישה מחדש", ar: "إعادة الشراء" },
  "tableLimit": { ru: "Лимит стола", en: "Table limit", he: "גבול שולחן", ar: "حد الطاولة" },
  "secondsToRemoval": { ru: "секунд до удаления", en: "seconds until removal", he: "שניות עד להסרה", ar: "ثواني حتى الإزالة" },
  "stackAtMax": { ru: "Ваш стек уже на максимуме стола", en: "Your stack is at table maximum", he: "הסטאק שלך במקסימום", ar: "رصيدك في الحد الأقصى" },
  "notEnoughForRebuy": { ru: "Недостаточно средств для докупки", en: "Not enough funds for rebuy", he: "אין מספיק כסף לרכישה", ar: "لا يوجد ما يكفي للإعادة" },
  "leave": { ru: "Уйти", en: "Leave", he: "עזוב", ar: "غادر" },
  "addMoney": { ru: "Добавить денег на стол", en: "Add money to table", he: "הוסף כסף לשולחן", ar: "أضف أموالاً للطاولة" },
  "tableInfo": { ru: "Инфо о столе", en: "Table Info", he: "מידע על השולחן", ar: "معلومات الطاولة" },
  "toLobby": { ru: "В Лобби", en: "To Lobby", he: "ללובי", ar: "إلى اللوبي" },
  "share": { ru: "Поделиться", en: "Share", he: "שתף", ar: "شارك" },
  "joinTable": { ru: "Присоединяйся к столу", en: "Join the table", he: "הצטרף לשולחן", ar: "انضم للطاولة" },
  "linkCopied": { ru: "Ссылка скопирована", en: "Link copied", he: "הקישור הועתק", ar: "تم نسخ الرابط" },
  "holdemUnlimited": { ru: "Холдем • Безлимитный", en: "Hold'em • No Limit", he: "הולדם • ללא גבול", ar: "هولدم • بلا حدود" },
  "stakes": { ru: "Ставки", en: "Stakes", he: "הימורים", ar: "الرهانات" },
  "menu": { ru: "Меню", en: "Menu", he: "תפריט", ar: "القائمة" },
  "seat": { ru: "Место", en: "Seat", he: "מקום", ar: "مقعد" },
  "selectBuyInAmount": { ru: "Выберите сумму бай-ина", en: "Select buy-in amount", he: "בחר סכום כניסה", ar: "اختر مبلغ الشراء" },
  "sit": { ru: "Сесть", en: "Sit", he: "שב", ar: "اجلس" },
  "bothAllIn": { ru: "Оба игрока All-In! Выберите количество бордов", en: "Both players All-In! Choose number of boards", he: "שני שחקנים אול-אין! בחר מספר לוחות", ar: "كلا اللاعبين All-In! اختر عدد اللوحات" },
  "playingTwoBoards": { ru: "Играем 2 борда!", en: "Playing 2 boards!", he: "משחקים 2 לוחות!", ar: "نلعب لوحتين!" },
  "playingOneBoard": { ru: "Играем 1 борд", en: "Playing 1 board", he: "משחקים לוח 1", ar: "نلعب لوحة واحدة" },
  "board": { ru: "борд", en: "Board", he: "לוח", ar: "لوحة" },
  "boards": { ru: "борда", en: "Boards", he: "לוחות", ar: "لوحات" },
  "youSelected": { ru: "Вы выбрали", en: "You selected", he: "בחרת", ar: "اخترت" },
  "waitingForOpponent": { ru: "Ожидание оппонента...", en: "Waiting for opponent...", he: "ממתין ליריב...", ar: "في انتظار الخصم..." },
  "secondsUntilRemoval": { ru: "секунд до удаления", en: "seconds until removal", he: "שניות עד להסרה", ar: "ثوانٍ حتى الإزالة" },
  "insufficientForRebuy": { ru: "Недостаточно средств для докупки", en: "Insufficient funds for rebuy", he: "אין מספיק כסף לרכישה מחדש", ar: "رصيد غير كافٍ للإعادة" },
  "addChipsToTable": { ru: "Добавить денег на стол", en: "Add chips to table", he: "הוסף צ'יפים לשולחן", ar: "أضف رقاقات للطاولة" },
  "holdem": { ru: "Холдем", en: "Hold'em", he: "הולדם", ar: "هولدم" },
  "noLimit": { ru: "Безлимитный", en: "No Limit", he: "ללא הגבלה", ar: "بلا حدود" },
  "minBuyIn": { ru: "Мин. бай-ин", en: "Min. buy-in", he: "כניסה מינ.", ar: "الحد الأدنى للشراء" },
  "maxBuyIn": { ru: "Макс. бай-ин", en: "Max. buy-in", he: "כניסה מקס.", ar: "الحد الأقصى للشراء" },
  "seatsAtTable": { ru: "Мест за столом", en: "Seats at table", he: "מקומות בשולחן", ar: "مقاعد على الطاولة" },
  "actionTime": { ru: "Время на ход", en: "Action time", he: "זמן לפעולה", ar: "وقت الإجراء" },
  "playersNow": { ru: "Игроков сейчас", en: "Players now", he: "שחקנים כעת", ar: "اللاعبون الآن" },
  "soundAndVibration": { ru: "Звук и вибрация", en: "Sound & vibration", he: "צליל ורטט", ar: "الصوت والاهتزاز" },
  "gameSounds": { ru: "Звуки игры", en: "Game sounds", he: "צלילי משחק", ar: "أصوات اللعبة" },
  "vibration": { ru: "Вибрация", en: "Vibration", he: "רטט", ar: "الاهتزاز" },
  "pokerSoundsOnlyNote": { ru: "В покере используются только звуки карт и фишек (без музыки)", en: "Poker uses only card and chip sounds (no music)", he: "בפוקר יש רק צלילי קלפים וצ'יפים (ללא מוזיקה)", ar: "البوكر يستخدم أصوات البطاقات والرقائق فقط (بدون موسيقى)" },
  "done": { ru: "Готово", en: "Done", he: "סיום", ar: "تم" },
  "returnToGame": { ru: "Вернуться", en: "Return", he: "חזור", ar: "العودة" },
  "skipHand": { ru: "Пропустить", en: "Skip", he: "דלג", ar: "تخطي" },
  
  // Poker Lobby
  "bonusEveryDeposit": { ru: "Бонусы на каждый повторный депозит!", en: "Bonuses on every deposit!", he: "בונוסים על כל הפקדה!", ar: "مكافآت على كل إيداع!" },
  "tablesCount": { ru: "столов", en: "tables", he: "שולחנות", ar: "طاولات" },
  "sitAndGo": { ru: "Sit & Go Турниры", en: "Sit & Go Tournaments", he: "טורניר Sit & Go", ar: "بطولات Sit & Go" },
  "spinAndGo": { ru: "Spin & Go", en: "Spin & Go", he: "Spin & Go", ar: "Spin & Go" },
  "upToMultiplier": { ru: "До", en: "Up to", he: "עד", ar: "حتى" },
  "totalRake": { ru: "Общий рейк", en: "Total Rake", he: "רייק כולל", ar: "إجمالي الريك" },
  "gameActive": { ru: "Игра", en: "Game", he: "משחק", ar: "لعبة" },
  "playersCount": { ru: "игроков", en: "players", he: "שחקנים", ar: "لاعبين" },
  "startingStack": { ru: "Стек", en: "Stack", he: "סטאק", ar: "الرصيد" },
  "prizeStructure": { ru: "Призовые", en: "Prizes", he: "פרסים", ar: "الجوائز" },
  "howToPlaySitGo": { ru: "Как играть", en: "How to Play", he: "איך לשחק", ar: "كيف تلعب" },
  "sitGoDescription": { ru: "Sit & Go начинается когда все места заполнены. Блайнды увеличиваются каждые 3-6 минут. Победитель забирает призовой фонд согласно структуре выплат.", en: "Sit & Go starts when all seats are filled. Blinds increase every 3-6 minutes. Winner takes the prize pool according to payout structure.", he: "Sit & Go מתחיל כשכל המקומות מלאים. הבליינדים עולים כל 3-6 דקות.", ar: "يبدأ Sit & Go عندما تمتلئ جميع المقاعد." },
  "adminControls": { ru: "Админ-контроли", en: "Admin Controls", he: "בקרות מנהל", ar: "عناصر التحكم" },
  "refresh": { ru: "Обновить", en: "Refresh", he: "רענן", ar: "تحديث" },
  "closeTable": { ru: "Закрыть стол", en: "Close Table", he: "סגור שולחן", ar: "أغلق الطاولة" },
  "noTablesWithPlayers": { ru: "Нет столов с игроками", en: "No tables with players", he: "אין שולחנות עם שחקנים", ar: "لا توجد طاولات مع لاعبين" },
  
  
  // Game Lobby
  "referralBonus": { ru: "Реферальный бонус", en: "Referral Bonus", he: "בונוס הפניה", ar: "مكافأة الإحالة" },
  "inviteFriendsEarn": { ru: "Приглашай друзей и зарабатывай", en: "Invite friends & earn", he: "הזמן חברים והרוויח", ar: "ادعُ الأصدقاء واربح" },
  "bigWinAwaits": { ru: "БОЛЬШОЙ ВЫИГРЫШ ЖДЁТ!", en: "BIG WIN AWAITS!", he: "זכייה גדולה מחכה!", ar: "فوز كبير ينتظرك!" },
  "depositAndPlay": { ru: "Пополни счёт и начни выигрывать", en: "Deposit now & start winning", he: "הפקד עכשיו והתחל לנצח", ar: "أودع الآن وابدأ بالفوز" },
  "doubleDeposit": { ru: "УДВОЙ СВОЙ ДЕПОЗИТ!", en: "DOUBLE YOUR DEPOSIT!", he: "הכפל את ההפקדה שלך!", ar: "ضاعف إيداعك!" },
  "firstDepositBonus": { ru: "Бонус +100% на первый депозит", en: "First deposit bonus +100%", he: "בונוס +100% על הפקדה ראשונה", ar: "مكافأة +100% على الإيداع الأول" },
  "buyStarsBonus": { ru: "КУПИ STARS +30%", en: "BUY STARS +30%", he: "קנה כוכבים +30%", ar: "اشترِ نجوم +30%" },
  "starsPromoDesc": { ru: "Получи дополнительно 30% Stars при покупке", en: "Get extra 30% Stars on purchase", he: "קבל 30% כוכבים נוספים ברכישה", ar: "احصل على 30% نجوم إضافية عند الشراء" },
  "referralRewardDesc": { ru: "Получи $5 за каждого друга + 15% с проигрышей!", en: "Get $5 for each friend + 15% from their losses!", he: "קבל $5 לכל חבר + 15% מההפסדים שלהם!", ar: "احصل على $5 لكل صديق + 15% من خسائرهم!" },
  "gamesTemporarilyUnavailable": { ru: "Игры временно недоступны", en: "Games temporarily unavailable", he: "משחקים לא זמינים זמנית", ar: "الألعاب غير متاحة مؤقتًا" },
  "tryLater": { ru: "Попробуйте позже", en: "Please try again later", he: "נסה שוב מאוחר יותר", ar: "يرجى المحاولة لاحقًا" },
  "fairPlayGuaranteed": { ru: "Гарантия честной игры", en: "Fair Play Guaranteed", he: "משחק הוגן מובטח", ar: "اللعب النظيف مضمون" },
  "fairPlayDescription": { ru: "Мы используем проверяемый генератор случайных чисел", en: "We use a verifiable random number generator", he: "אנחנו משתמשים במחולל מספרים אקראי מאומת", ar: "نستخدم مولد أرقام عشوائية يمكن التحقق منه" },
  "support": { ru: "Поддержка", en: "Support", he: "תמיכה", ar: "الدعم" },
  "supportDescription": { ru: "По любым вопросам обращайтесь сюда!", en: "Contact us for any questions!", he: "פנה אלינו בכל שאלה!", ar: "تواصل معنا لأي أسئلة!" },
  "wheel": { ru: "Колесо", en: "Wheel", he: "גלגל", ar: "العجلة" },
  
  // VIP Chat
  "chatAvailableVip": { ru: "Чат доступен для VIP игроков", en: "Chat available for VIP players", he: "הצ'אט זמין לשחקני VIP", ar: "الدردشة متاحة للاعبي VIP" },
  "noMessagesYet": { ru: "Пока нет сообщений. Будьте первым!", en: "No messages yet. Be the first!", he: "אין הודעות עדיין. היה הראשון!", ar: "لا رسائل بعد. كن الأول!" },
  "chars": { ru: "симв.", en: "chars", he: "תווים", ar: "أحرف" },
  "waitSeconds": { ru: "Подождите", en: "Wait", he: "המתן", ar: "انتظر" },
  
  // Daily Wheel
  "spinOnceDaily": { ru: "Крутите раз в день и выигрывайте до $5!", en: "Spin once daily and win up to $5!", he: "סובב פעם ביום וזכה עד $5!", ar: "أدر مرة يوميًا واربح حتى $5!" },
  "spinning": { ru: "Крутится...", en: "Spinning...", he: "מסתובב...", ar: "يدور..." },
  "failedToSpin": { ru: "Не удалось крутить колесо", en: "Failed to spin the wheel", he: "לא הצלחתי לסובב את הגלגל", ar: "فشل في تدوير العجلة" },
  "betterLuckNextTime": { ru: "Не повезло!", en: "Better luck next time!", he: "בהצלחה בפעם הבאה!", ar: "حظ أفضل في المرة القادمة!" },
  
  // Raffle Panel
  "noParticipants": { ru: "Нет участников", en: "No participants", he: "אין משתתפים", ar: "لا يوجد مشاركون" },
  "spinningWheel": { ru: "Крутим колесо...", en: "Spinning wheel...", he: "מסובב את הגלגל...", ar: "تدوير العجلة..." },
  "youreIn": { ru: "Вы участвуете!", en: "You're in!", he: "אתה בפנים!", ar: "أنت مشارك!" },
  "joinRaffle": { ru: "Участвовать", en: "Join Raffle", he: "הצטרף להגרלה", ar: "انضم للسحب" },
  "active": { ru: "Идёт", en: "Active", he: "פעיל", ar: "نشط" },
  "drawing": { ru: "Розыгрыш!", en: "Drawing!", he: "מגריל!", ar: "السحب!" },
  "completed": { ru: "Завершён", en: "Completed", he: "הושלם", ar: "مكتمل" },
  "soon": { ru: "Скоро", en: "Soon", he: "בקרוב", ar: "قريبًا" },
  "required": { ru: "Требуется", en: "Required", he: "נדרש", ar: "مطلوب" },
  "requiredVipStatus": { ru: "Требуется статус", en: "Required status", he: "סטטוס נדרש", ar: "الحالة المطلوبة" },
  "requiredDeposit": { ru: "Требуется депозитов", en: "Required deposits", he: "הפקדות נדרשות", ar: "الإيداعات المطلوبة" },
  
  // Profile Page
  "codeCreated": { ru: "Код создан", en: "Code created", he: "הקוד נוצר", ar: "تم إنشاء الرمز" },
  "yourCode": { ru: "Ваш код", en: "Your code", he: "הקוד שלך", ar: "الرمز الخاص بك" },
  "bonusReceived": { ru: "Бонус получен!", en: "Bonus received!", he: "הבונוס התקבל!", ar: "تم استلام المكافأة!" },
  "invalidReferralCode": { ru: "Неверный реферальный код", en: "Invalid referral code", he: "קוד הפניה לא תקף", ar: "رمز إحالة غير صالح" },
  "referralCodeCopied": { ru: "Реферальный код скопирован", en: "Referral code copied", he: "קוד ההפניה הועתק", ar: "تم نسخ رمز الإحالة" },
  "joinPapaCasino": { ru: "Присоединяйся в Papa Casino!", en: "Join Papa Casino!", he: "הצטרף ל-Papa Casino!", ar: "انضم إلى Papa Casino!" },
  "getBonusByLink": { ru: "Получи бонус по моей ссылке", en: "Get bonus with my link", he: "קבל בונוס עם הקישור שלי", ar: "احصل على مكافأة برابطي" },
  "totalDeposited": { ru: "Всего депозитов", en: "Total deposited", he: "סה״כ הופקד", ar: "إجمالي المودع" },
  "becomeVipForChat": { ru: "Станьте VIP и получите доступ к чату!", en: "Become VIP and get chat access!", he: "הפוך ל-VIP וקבל גישה לצ'אט!", ar: "كن VIP واحصل على الدردشة!" },
  "manageCasino": { ru: "Управление казино, пользователями и настройками", en: "Manage casino, users and settings", he: "ניהול הקזינו, משתמשים והגדרות", ar: "إدارة الكازينو والمستخدمين والإعدادات" },
  "devModeSwitchAccount": { ru: "Dev Mode: Сменить аккаунт", en: "Dev Mode: Switch Account", he: "מצב פיתוח: החלף חשבון", ar: "وضع المطور: تبديل الحساب" },
  "loginAsDifferentUser": { ru: "Войти под другим Telegram username для тестирования", en: "Login as different Telegram username for testing", he: "התחבר עם שם משתמש אחר לבדיקות", ar: "سجل دخول كمستخدم مختلف للاختبار" },
  "accountChanged": { ru: "Аккаунт изменён", en: "Account changed", he: "החשבון שונה", ar: "تم تغيير الحساب" },
  "nowLoggedAs": { ru: "Теперь вы вошли как", en: "Now logged in as", he: "מחובר כעת כ", ar: "تم تسجيل الدخول كـ" },
  "returnedToAdmin": { ru: "Вернулись к админу", en: "Returned to admin", he: "חזרת למנהל", ar: "العودة للمسؤول" },
  "returnToAdmin": { ru: "Вернуться к @Nahalist (Admin)", en: "Return to @Nahalist (Admin)", he: "חזור ל-@Nahalist (מנהל)", ar: "العودة إلى @Nahalist (المسؤول)" },
  "devModeDescription": { ru: "Этот раздел виден только в режиме разработки. В Telegram будет использоваться реальный аккаунт.", en: "This section is only visible in dev mode. In Telegram, your real account will be used.", he: "סעיף זה נראה רק במצב פיתוח. בטלגרם, החשבון האמיתי שלך ישמש.", ar: "هذا القسم مرئي فقط في وضع المطور. في Telegram، سيتم استخدام حسابك الحقيقي." },
  "inviteFriendsEarn2": { ru: "Приглашай друзей и получай $5 + 15% с их проигрышей", en: "Invite friends and earn $5 + 15% from their losses", he: "הזמן חברים והרוויח $5 + 15% מההפסדים שלהם", ar: "ادعُ الأصدقاء واربح $5 + 15% من خسائرهم" },
  "friendsInvited": { ru: "Приглашено", en: "Friends Invited", he: "חברים הוזמנו", ar: "الأصدقاء المدعوون" },
  "totalEarned": { ru: "Заработано", en: "Total Earned", he: "סה״כ הרוויח", ar: "إجمالي المكتسب" },
  "generating": { ru: "Генерация...", en: "Generating...", he: "יוצר...", ar: "جاري الإنشاء..." },
  "haveReferralCode": { ru: "Есть реферальный код?", en: "Have a referral code?", he: "יש לך קוד הפניה?", ar: "هل لديك رمز إحالة؟" },
  "enterFriendCode": { ru: "Введите код друга и получите $5 бонус", en: "Enter a friend's code to receive $5 bonus", he: "הכנס קוד של חבר לקבלת בונוס $5", ar: "أدخل رمز صديق للحصول على مكافأة $5" },
  "enterCode": { ru: "Введите код", en: "Enter code", he: "הכנס קוד", ar: "أدخل الرمز" },
  "applyCode": { ru: "Применить код", en: "Apply Code", he: "החל קוד", ar: "تطبيق الرمز" },
  "applying": { ru: "Применяется...", en: "Applying...", he: "מחיל...", ar: "جاري التطبيق..." },
  "login": { ru: "Войти", en: "Login", he: "התחבר", ar: "تسجيل الدخول" },
  
  // Game Help Rules
  "tips": { ru: "Советы", en: "Tips", he: "טיפים", ar: "نصائح" },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("language");
      if (saved && ["ru", "en", "he", "ar"].includes(saved)) {
        return saved as Language;
      }
    }
    return "ru";
  });

  const isRTL = language === "he" || language === "ar";

  useEffect(() => {
    localStorage.setItem("language", language);
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language, isRTL]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    const translation = translations[key];
    if (translation) {
      return translation[language];
    }
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  const languages: { code: Language; label: string; flag: string }[] = [
    { code: "en", label: "EN", flag: "🇺🇸" },
    { code: "ru", label: "RU", flag: "🇷🇺" },
    { code: "he", label: "HE", flag: "🇮🇱" },
    { code: "ar", label: "AR", flag: "🇸🇦" },
  ];

  const currentIndex = languages.findIndex(l => l.code === language);
  
  const nextLanguage = () => {
    const nextIndex = (currentIndex + 1) % languages.length;
    setLanguage(languages[nextIndex].code);
  };

  return (
    <button
      onClick={nextLanguage}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 border border-emerald-500/30 hover:bg-black/60 transition-all duration-200"
      data-testid="button-language-toggle"
    >
      <span className="text-sm">{languages[currentIndex].flag}</span>
      <span className="text-xs font-bold text-emerald-400">
        {languages[currentIndex].label}
      </span>
    </button>
  );
}
