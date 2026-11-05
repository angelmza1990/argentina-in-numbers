"""Every series the site uses, with where it comes from.

argentinadatos.com  daily exchange rates (official, blue, MEP, CCL, wholesale, crypto, card),
                    monthly inflation since 1943, country risk, UVA, bank deposit rates
BCRA API v4         reserves, money, interest rates, inflation expectations
datos.gob.ar        INDEC and Ministry of Economy series: CPI by category, activity, jobs,
                    poverty, wages, minimum wage, pensions, trade, fiscal balance
World Bank          long-run GDP, GDP per capita and population since 1960
"""

DOLLARS = [
    # (casa in argentinadatos, label)
    ("oficial", "Official (retail)"),
    ("mayorista", "Wholesale"),
    ("blue", "Blue (informal)"),
    ("bolsa", "MEP (stock market)"),
    ("contadoconliqui", "CCL (offshore)"),
    ("cripto", "Crypto (USDT)"),
    ("tarjeta", "Card (with taxes)"),
]

AD_INDICES = ["inflacion", "inflacionInteranual", "riesgo-pais", "uva"]

# (BCRA variable id, key, label, unit)
BCRA = [
    (1, "reserves", "International reserves", "USD millions"),
    (5, "wholesaleFx", "Wholesale exchange rate (Com. A 3500)", "ARS per USD"),
    (15, "base", "Monetary base", "ARS millions"),
    (109, "m2", "M2", "ARS millions"),
    (12, "deposit30", "30-day term deposit rate", "% nominal annual"),
    (7, "badlar", "BADLAR rate, private banks", "% nominal annual"),
    (160, "policyRate", "Monetary policy rate", "% nominal annual"),
    (26, "loans", "Loans to the private sector", "ARS millions"),
    (29, "expectations", "Expected inflation, next 12 months (REM median)", "%"),
    (30, "cer", "CER index", "index"),
    (40, "icl", "Rental contracts index (ICL)", "index"),
]

# (datos.gob.ar series id, key, label)
# Recreation and restaurants (146.3_IRECREANAL, 146.3_IRESTAUNAL), annual imports since 1910
# (74.1_IIT) and the 1982-2003 unemployment series (42.2_EPDT) return no data from the API.
SERIES = [
    ("148.3_INIVELNAL_DICI_M_26", "cpi", "CPI, national, all items"),
    ("148.3_INUCLEONAL_DICI_M_19", "cpiCore", "CPI, core"),
    ("148.3_IREGULANAL_DICI_M_22", "cpiRegulated", "CPI, regulated prices"),
    ("146.3_IALIMENNAL_DICI_M_45", "cpi_food", "Food and non-alcoholic beverages"),
    ("146.3_IBEBIDANAL_DICI_M_39", "cpi_alcohol", "Alcoholic beverages and tobacco"),
    ("146.3_IPRENDANAL_DICI_M_35", "cpi_clothing", "Clothing and footwear"),
    ("146.3_IVIVIENNAL_DICI_M_52", "cpi_housing", "Housing, water, electricity and fuels"),
    ("146.3_IEQUIPANAL_DICI_M_46", "cpi_household", "Household equipment"),
    ("146.3_ISALUDNAL_DICI_M_18", "cpi_health", "Health"),
    ("146.3_ITRANSPNAL_DICI_M_23", "cpi_transport", "Transport"),
    ("146.3_ICOMUNINAL_DICI_M_27", "cpi_communication", "Communication"),
    ("146.3_IEDUCACNAL_DICI_M_22", "cpi_education", "Education"),
    ("146.3_IBIENESNAL_DICI_M_36", "cpi_other", "Other goods and services"),
    ("143.3_NO_PR_2004_A_31", "emae", "Economic activity (EMAE), seasonally adjusted"),
    ("42.3_EPH_PUNTUATAL_0_M_30", "unemployment", "Unemployment rate (EPH, since 2003)"),
    ("64.2_POBLACION_NUA_0_0_34_74", "poverty", "People below the poverty line"),
    ("63.2_HOGARES_PONUA_0_0_33_21", "povertyHouseholds", "Households below the poverty line"),
    ("150.1_LA_POBREZA_0_D_13", "povertyLine", "Poverty line per adult equivalent"),
    ("149.1_TL_INDIIOS_OCTU_0_21", "wages", "Wage index, all workers"),
    ("149.1_SOR_PRIADO_OCTU_0_25", "wagesPrivate", "Wage index, registered private sector"),
    ("149.1_SOR_PUBICO_OCTU_0_14", "wagesPublic", "Wage index, public sector"),
    ("57.1_SMVMM_0_M_34", "minWage", "Minimum wage (monthly)"),
    ("58.1_MP_0_M_13", "minPension", "Minimum pension"),
    ("74.3_IET_0_M_16", "exports", "Exports, monthly"),
    ("74.3_IIT_0_M_25", "imports", "Imports, monthly"),
    ("74.1_IET_0_A_16", "exportsYear", "Exports, annual"),
    ("452.3_RESULTADO_RIO_0_M_18_54", "primary", "Primary fiscal balance, national government"),
]

# (World Bank indicator, key, label)
WORLD_BANK = [
    ("NY.GDP.MKTP.KD.ZG", "gdpGrowth", "GDP growth"),
    ("NY.GDP.PCAP.KD", "gdpPerCapReal", "GDP per capita, constant 2015 USD"),
    ("NY.GDP.PCAP.CD", "gdpPerCap", "GDP per capita, current USD"),
    ("NY.GDP.MKTP.CD", "gdp", "GDP, current USD"),
    ("SP.POP.TOTL", "population", "Population"),
    ("SI.POV.GINI", "gini", "Gini index"),
]
