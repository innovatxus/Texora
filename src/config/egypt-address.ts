/**
 * Egyptian address checks: the main cities and districts of each governorate
 * (offered as suggestions and used to catch an area entered under the wrong
 * governorate) and each governorate's postal-code prefix. Unknown areas are
 * accepted (villages and new compounds aren't all listed); only a clear
 * mismatch is refused. Shared by the browser forms and the server.
 */
import { GOVERNORATES, governorateName, type GovernorateCode } from "./locale";

/** Main cities and districts per governorate, in English as couriers use them. */
export const GOVERNORATE_AREAS: Record<GovernorateCode, readonly string[]> = {
  C: [
    "Nasr City",
    "Heliopolis",
    "New Cairo",
    "Fifth Settlement",
    "Maadi",
    "Zamalek",
    "Garden City",
    "Mokattam",
    "Shorouk",
    "Madinaty",
    "Rehab",
    "Helwan",
    "Shubra",
    "Ain Shams",
    "Abbassia",
    "Manial",
    "Sayeda Zeinab",
    "Zaytoun",
    "Matareya",
    "Marg",
    "Salam City",
    "Hadayek El Kobba",
    "Masr El Gedida",
    "Katameya",
    "Tagamoa",
    "15th of May",
    "New Administrative Capital",
    "Basatin",
    "Dar El Salam",
    "Old Cairo",
    "Abdeen",
    "Bulaq",
    "Rod El Farag",
  ],
  GZ: [
    "Dokki",
    "Mohandessin",
    "Agouza",
    "Haram",
    "Faisal",
    "Imbaba",
    "Sheikh Zayed",
    "6th of October",
    "Hadayek October",
    "Smart Village",
    "Bulaq El Dakrour",
    "Omraniya",
    "Warraq",
    "Kit Kat",
    "Hawamdeya",
    "Badrashin",
    "Ayat",
    "Saff",
    "Atfih",
    "Kerdasa",
    "Abu Rawash",
    "Oseem",
    "Mansoureya",
    "Bahariya",
    "Manyal Shiha",
  ],
  ALX: [
    "Smouha",
    "Sidi Gaber",
    "Stanley",
    "Gleem",
    "Sporting",
    "Roushdy",
    "Miami",
    "Montaza",
    "Mandara",
    "Agami",
    "Borg El Arab",
    "New Borg El Arab",
    "Sidi Bishr",
    "Louran",
    "Kafr Abdo",
    "Camp Shezar",
    "Ibrahimia",
    "Raml Station",
    "Manshiya",
    "Anfoushi",
    "Mansheya",
    "Amreya",
    "Max",
    "Abu Qir",
    "Maamoura",
    "Victoria",
    "Bacchus",
    "Cleopatra",
    "Fleming",
    "Laurent",
  ],
  KB: [
    "Banha",
    "Shubra El Kheima",
    "Qalyub",
    "Obour",
    "Khanka",
    "Kafr Shukr",
    "Tukh",
    "Qaha",
    "Shibin El Qanater",
    "Khosous",
  ],
  DK: [
    "Mansoura",
    "Talkha",
    "Mit Ghamr",
    "Aga",
    "Sinbillawin",
    "Dikirnis",
    "Belqas",
    "Sherbin",
    "Minyat El Nasr",
    "Gamasa",
    "Manzala",
  ],
  SHR: [
    "Zagazig",
    "10th of Ramadan",
    "Belbeis",
    "Abu Hammad",
    "Minya El Qamh",
    "Faqous",
    "Hehya",
    "Abu Kabir",
    "Kafr Saqr",
    "Diyarb Negm",
    "Husseiniya",
    "Mashtoul El Souk",
  ],
  GH: [
    "Tanta",
    "El Mahalla El Kubra",
    "Mahalla",
    "Kafr El Zayat",
    "Zifta",
    "Samanoud",
    "Basyoun",
    "Qutur",
    "Santa",
    "Sebennytos",
  ],
  MNF: [
    "Shebin El Kom",
    "Menouf",
    "Sadat City",
    "Ashmoun",
    "Quesna",
    "Berket El Sab",
    "Tala",
    "Bagour",
    "Shohada",
    "Sers El Layan",
  ],
  BH: [
    "Damanhour",
    "Kafr El Dawwar",
    "Rashid",
    "Rosetta",
    "Edku",
    "Abu Hummus",
    "Kom Hamada",
    "Itay El Barud",
    "Shubrakhit",
    "Wadi El Natrun",
    "Hosh Issa",
    "Abu El Matamir",
  ],
  KFS: [
    "Kafr El Sheikh",
    "Desouk",
    "Baltim",
    "Fuwwah",
    "Sidi Salem",
    "Qallin",
    "Bila",
    "Hamool",
    "Metoubes",
  ],
  DT: [
    "Damietta",
    "New Damietta",
    "Ras El Bar",
    "Faraskur",
    "Kafr Saad",
    "Zarqa",
    "Kafr El Batikh",
    "Ezbet El Borg",
  ],
  PTS: ["Port Said", "Port Fouad", "Zohour", "Manakh", "Dawahy"],
  IS: ["Ismailia", "Fayed", "Qantara", "Qantara Sharq", "Tell El Kebir", "Abu Suwir", "Kasasin"],
  SUZ: ["Suez", "Ain Sokhna", "Ataka", "Arbaeen", "Faisal", "Ganayen"],
  FYM: ["Faiyum", "Sinnuris", "Ibsheway", "Itsa", "Tamiya", "Yusuf El Seddik", "New Faiyum"],
  BNS: ["Beni Suef", "New Beni Suef", "Wasta", "Ihnasya", "Biba", "Fashn", "Somosta"],
  MN: [
    "Minya",
    "New Minya",
    "Mallawi",
    "Samalut",
    "Maghagha",
    "Beni Mazar",
    "Matai",
    "Abu Qurqas",
    "Deir Mawas",
    "Adwa",
  ],
  AST: [
    "Asyut",
    "New Asyut",
    "Dayrout",
    "Manfalut",
    "Abnub",
    "Abu Tig",
    "Qusiya",
    "Sahel Selim",
    "Badari",
    "Sidfa",
    "Ghanayem",
  ],
  SHG: [
    "Sohag",
    "New Sohag",
    "Akhmim",
    "Girga",
    "Tahta",
    "Tama",
    "Maragha",
    "Balyana",
    "Dar El Salam",
    "Juhayna",
    "Saqulta",
    "Munsha'a",
  ],
  KN: [
    "Qena",
    "New Qena",
    "Nag Hammadi",
    "Qus",
    "Dishna",
    "Farshut",
    "Abu Tesht",
    "Naqada",
    "Qift",
    "Waqf",
  ],
  LX: [
    "Luxor",
    "New Luxor",
    "Karnak",
    "Armant",
    "Esna",
    "Tod",
    "Bayadeya",
    "Zeiniya",
    "Qurna",
    "New Tiba",
  ],
  ASN: [
    "Aswan",
    "New Aswan",
    "Kom Ombo",
    "Edfu",
    "Daraw",
    "Nasr El Nuba",
    "Abu Simbel",
    "Kalabsha",
  ],
  BA: [
    "Hurghada",
    "El Gouna",
    "Safaga",
    "Quseir",
    "Marsa Alam",
    "Ras Gharib",
    "Shalateen",
    "Sahl Hasheesh",
    "Makadi Bay",
    "Soma Bay",
  ],
  WAD: ["Kharga", "Dakhla", "Farafra", "Baris", "Balat", "Mut"],
  MT: [
    "Marsa Matrouh",
    "Matrouh",
    "El Alamein",
    "New Alamein",
    "Sidi Abdel Rahman",
    "Dabaa",
    "Siwa",
    "Sallum",
    "North Coast",
    "Sahel",
    "Marina",
  ],
  SIN: ["Arish", "Sheikh Zuweid", "Rafah", "Bir El Abd", "Hasana", "Nakhl"],
  JS: [
    "Sharm El Sheikh",
    "Dahab",
    "Nuweiba",
    "Taba",
    "El Tor",
    "Saint Catherine",
    "Ras Sudr",
    "Abu Zenima",
    "Abu Rudeis",
  ],
};

/** Other names people write for a governorate (Arabic and common spellings). */
const GOVERNORATE_ALIASES: Partial<Record<GovernorateCode, readonly string[]>> = {
  C: ["القاهرة", "Cairo", "Kairo"],
  GZ: ["الجيزة", "Giza", "Gizeh", "Guiza"],
  ALX: ["الإسكندرية", "الاسكندرية", "Alexandria", "Alex", "Iskandariya"],
  KB: ["القليوبية", "Qalyubia", "Kalyoubia", "Qaliubiya"],
  DK: ["الدقهلية", "Dakahlia", "Dakahleya"],
  SHR: ["الشرقية", "Sharqia", "Sharkia", "Sharkeya"],
  GH: ["الغربية", "Gharbia", "Gharbeya"],
  MNF: ["المنوفية", "Monufia", "Menoufia", "Menofia"],
  BH: ["البحيرة", "Beheira", "Behera", "Bohaira"],
  KFS: ["كفر الشيخ"],
  DT: ["دمياط", "Dumyat"],
  PTS: ["بورسعيد", "بور سعيد", "Portsaid"],
  IS: ["الإسماعيلية", "الاسماعيلية", "Ismailiya"],
  SUZ: ["السويس", "Suez"],
  FYM: ["الفيوم", "Fayoum", "Fayum"],
  BNS: ["بني سويف", "Bani Suef", "Beni Sweif"],
  MN: ["المنيا", "Minia", "El Minya"],
  AST: ["أسيوط", "اسيوط", "Assiut", "Asyout"],
  SHG: ["سوهاج", "Suhag"],
  KN: ["قنا", "Kena"],
  LX: ["الأقصر", "الاقصر", "Luxor"],
  ASN: ["أسوان", "اسوان", "Assuan"],
  BA: ["البحر الأحمر", "البحر الاحمر"],
  WAD: ["الوادي الجديد", "Wadi El Gedid"],
  MT: ["مطروح", "Marsa Matruh", "Mersa Matruh"],
  SIN: ["شمال سيناء"],
  JS: ["جنوب سيناء"],
};

/** The first two digits of each governorate's postal codes (Egypt Post). */
export const POSTAL_PREFIXES: Record<GovernorateCode, readonly string[]> = {
  C: ["11"],
  GZ: ["12"],
  KB: ["13"],
  ALX: ["21"],
  BH: ["22"],
  GH: ["31"],
  MNF: ["32"],
  KFS: ["33"],
  DT: ["34"],
  DK: ["35"],
  IS: ["41"],
  PTS: ["42"],
  SUZ: ["43"],
  SHR: ["44"],
  SIN: ["45"],
  JS: ["46"],
  MT: ["51"],
  MN: ["61"],
  BNS: ["62"],
  FYM: ["63"],
  AST: ["71"],
  WAD: ["72"],
  ASN: ["81"],
  SHG: ["82"],
  KN: ["83"],
  BA: ["84"],
  LX: ["85"],
};

/** Lower-cases and strips accents, punctuation, "el"/"al" and "city" so spellings compare. */
export function normalizeArea(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`.,\-_/()]/g, " ")
    .replace(/\b(el|al|the|city|district|markaz|madinet)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every known name (areas, governorate names and aliases) to the governorates it's in. */
const AREA_INDEX: ReadonlyMap<string, ReadonlySet<GovernorateCode>> = (() => {
  const index = new Map<string, Set<GovernorateCode>>();
  const add = (name: string, code: GovernorateCode) => {
    const key = normalizeArea(name);
    if (!key) return;
    const set = index.get(key) ?? new Set<GovernorateCode>();
    set.add(code);
    index.set(key, set);
  };
  for (const { code, name } of GOVERNORATES) {
    add(name, code);
    for (const alias of GOVERNORATE_ALIASES[code] ?? []) add(alias, code);
    for (const area of GOVERNORATE_AREAS[code]) add(area, code);
  }
  return index;
})();

/** The governorates a typed city or district belongs to (empty when not known). */
export function governoratesForArea(city: string): GovernorateCode[] {
  return [...(AREA_INDEX.get(normalizeArea(city)) ?? [])];
}

/** City suggestions for a governorate's address form. */
export function areaSuggestions(region: string): readonly string[] {
  return GOVERNORATE_AREAS[region as GovernorateCode] ?? [];
}

/** Adds each address problem to a Zod refinement, on the field it concerns. */
export function checkEgyptAddress(
  address: { city: string; region: string; postalCode?: string | undefined },
  ctx: { addIssue: (issue: { code: "custom"; path: string[]; message: string }) => void },
) {
  for (const problem of egyptAddressProblems(address)) {
    ctx.addIssue({ code: "custom", path: [problem.path], message: problem.message });
  }
}

export interface AddressProblem {
  path: "city" | "postalCode";
  message: string;
}

/**
 * Checks that an Egyptian address hangs together: the city or district isn't
 * one we know belongs to a different governorate, and a postal code (when
 * given) matches the governorate. Empty when the address looks right.
 */
export function egyptAddressProblems(address: {
  city: string;
  region: string;
  postalCode?: string | undefined;
}): AddressProblem[] {
  const problems: AddressProblem[] = [];
  const region = address.region as GovernorateCode;
  if (!(region in GOVERNORATE_AREAS)) return problems;

  const city = address.city.trim();
  if (city && !/\p{L}/u.test(city)) {
    problems.push({ path: "city", message: "Enter the name of the city or district" });
  } else if (city) {
    const owners = governoratesForArea(city);
    if (owners.length > 0 && !owners.includes(region)) {
      const other = governorateName(owners[0] as string);
      problems.push({
        path: "city",
        message: `${city} is in ${other}, not ${governorateName(region)}. Check the city or choose ${other}.`,
      });
    }
  }

  const postal = address.postalCode?.trim();
  if (postal && /^\d{5}$/.test(postal)) {
    const prefix = postal.slice(0, 2);
    if (!POSTAL_PREFIXES[region].includes(prefix)) {
      const owner = (Object.keys(POSTAL_PREFIXES) as GovernorateCode[]).find((code) =>
        POSTAL_PREFIXES[code].includes(prefix),
      );
      problems.push({
        path: "postalCode",
        message: owner
          ? `${postal} is a postal code for ${governorateName(owner)}. Check it, or leave it empty.`
          : `${postal} isn't an Egyptian postal code. Check it, or leave it empty.`,
      });
    }
  }
  return problems;
}
