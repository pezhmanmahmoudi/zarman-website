export type BankAccountLike = {
	id: string;
	account_name: string;
	currency: "AUD" | "IRT";
};

const IRT_PRIORITY = ["Blue B", "Melli", "Customer Credit_AUD"];
const AUD_PRIORITY = ["ST Bussiness", "Revolout", "Cash", "Customer Credit_AUD", "St. Joint"];

const IRT_PRIORITY_ALIASES: Record<string, string[]> = {
	"Blue B": ["blue b", "blu b", "blueb", "blub", "blue bank"],
	"Melli": ["melli", "bank melli", "melli b", "melli_b"],
	"Customer Credit_AUD": ["customer credit", "customer_credit", "customercredit", "customer_credit_aud"],
};

const AUD_PRIORITY_ALIASES: Record<string, string[]> = {
	"ST Bussiness": ["st bussiness", "st business", "st. bussiness", "st. business", "stbusiness"],
	"Revolout": ["revolout", "revolut", "revolut bank"],
	"Cash": ["cash"],
	"Customer Credit_AUD": ["customer credit", "customer_credit", "customercredit", "customer_credit_aud"],
	"St. Joint": ["st joint", "st. joint", "st_joint", "joint"],
};

function normalizeName(value: string) {
	return value.trim().toLowerCase();
}

function isCustomerCreditAccount(account: BankAccountLike) {
	return normalizeName(account.account_name) === "customer credit_aud";
}

function priorityRank(account: BankAccountLike) {
	const normalized = normalizeName(account.account_name);
	const priorityList = account.currency === "IRT" ? IRT_PRIORITY : AUD_PRIORITY;
	const aliasMap = account.currency === "IRT" ? IRT_PRIORITY_ALIASES : AUD_PRIORITY_ALIASES;

	const index = priorityList.findIndex((name) => {
		const target = normalizeName(name);
		const aliases = aliasMap[name] ?? [target];
		return aliases.some((alias) => normalized === alias || normalized.startsWith(alias) || normalized.includes(alias));
	});

	return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function sortBankAccountsByPriority<T extends BankAccountLike>(accounts: T[]): T[] {
	return [...accounts].sort((left, right) => {
		if (left.currency !== right.currency) {
			return left.currency === "IRT" ? -1 : 1;
		}

		const leftRank = priorityRank(left);
		const rightRank = priorityRank(right);
		if (leftRank !== rightRank) return leftRank - rightRank;

		return left.account_name.localeCompare(right.account_name, "en", { sensitivity: "base" });
	});
}

export function filterBankAccountsByLedgerType<T extends BankAccountLike>(
	accounts: T[],
	transactionType?: string,
): T[] {
	if (transactionType === "buy_aud") {
		return accounts.filter((account) => account.currency === "IRT" || isCustomerCreditAccount(account));
	}

	if (transactionType === "sell_aud") {
		return accounts.filter((account) => account.currency === "AUD");
	}

	return accounts;
}
