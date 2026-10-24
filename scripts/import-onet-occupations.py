#!/usr/bin/env python3
"""Reproduce the reviewed O*NET 31.0 subset; stdlib only, no model or paid API.

Downloads are cached outside the repository. Never infer a trend from a skill
rating. Existing synthetic CSV and the P2 engine are deliberately not rewritten.
"""
import csv
import hashlib
import io
import json
import pathlib
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "artifacts/career-pathways/public/data"
METADATA_OUTPUT = ROOT / "artifacts/career-pathways/src/data/occupation-catalog.json"
CACHE = pathlib.Path("/tmp/futurepath-onet31")
BASE = "https://www.onetcenter.org/dl_files/database/db_31_0_csv/"
FILES = [
    "occupation_data", "essential_skills", "transferable_skills", "knowledge",
    "software_skills", "job_zones", "job_zone_reference",
]
CATEGORIES = [
    ["Software and AI", "软件与 AI", "Perisian dan AI"],
    ["Data and finance", "数据与金融", "Data dan kewangan"],
    ["Engineering and manufacturing", "工程制造", "Kejuruteraan dan pembuatan"],
    ["Healthcare", "医疗健康", "Penjagaan kesihatan"],
    ["Environment and sustainability", "环境可持续", "Alam sekitar dan kelestarian"],
    ["Education and talent", "教育人才", "Pendidikan dan bakat"],
    ["Design and media", "设计传媒", "Reka bentuk dan media"],
    ["Operations and supply chain", "运营与供应链", "Operasi dan rantaian bekalan"],
]
# Code | translated title (ZH/MS) | intended goal | conditional contribution.
# Names, grouping, translations and SDG interpretations are app-authored.
# The official English title and description are read verbatim from the source.
SEEDS = """
15-1252.00|软件开发人员|Pembangun Perisian|9|develop reliable digital infrastructure|开发可靠的数字基础设施|membangunkan infrastruktur digital yang boleh dipercayai
15-1254.00|Web 开发人员|Pembangun Web|9|make useful web services easier to access|改善实用网络服务的可及性|memudahkan akses kepada perkhidmatan web yang berguna
15-1253.00|软件质量保证分析师与测试员|Penganalisis Jaminan Kualiti dan Penguji Perisian|9|detect failures in digital services before release|在发布前发现数字服务故障|mengesan kegagalan perkhidmatan digital sebelum pelancaran
15-1212.00|信息安全分析师|Penganalisis Keselamatan Maklumat|16|protect information systems and institutional records|保护信息系统与机构记录|melindungi sistem maklumat dan rekod institusi
15-1221.00|计算机与信息研究科学家|Saintis Penyelidikan Komputer dan Maklumat|9|research more efficient and reliable computing methods|研究更高效可靠的计算方法|menyelidik kaedah pengkomputeran yang lebih cekap dan dipercayai
15-1241.00|计算机网络架构师|Arkitek Rangkaian Komputer|9|design resilient communication networks|设计具备韧性的通信网络|mereka bentuk rangkaian komunikasi yang berdaya tahan
15-2051.00|数据科学家|Saintis Data|9|evaluate evidence for responsible technical innovation|为负责任的技术创新评估证据|menilai bukti bagi inovasi teknikal yang bertanggungjawab
15-1243.00|数据库架构师|Arkitek Pangkalan Data|9|design dependable data infrastructure|设计可靠的数据基础设施|mereka bentuk infrastruktur data yang boleh diharap
15-2051.01|商业智能分析师|Penganalisis Kecerdasan Perniagaan|8|identify operational inefficiencies using business data|运用业务数据识别运营低效|mengenal pasti ketidakcekapan operasi melalui data perniagaan
13-2011.00|会计师与审计师|Akauntan dan Juruaudit|16|improve the accuracy and accountability of financial records|提高财务记录的准确性与问责性|meningkatkan ketepatan dan akauntabiliti rekod kewangan
13-2061.00|金融审查员|Pemeriksa Kewangan|16|review financial institutions for compliance and accountable practices|审查金融机构的合规与问责实践|menyemak pematuhan dan akauntabiliti institusi kewangan
15-2011.00|精算师|Aktuari|8|assess long-term financial risks and obligations|评估长期财务风险与责任|menilai risiko dan tanggungan kewangan jangka panjang
17-2141.00|机械工程师|Jurutera Mekanikal|12|reduce material and energy waste in mechanical systems|减少机械系统中的材料与能源浪费|mengurangkan pembaziran bahan dan tenaga dalam sistem mekanikal
17-2071.00|电气工程师|Jurutera Elektrik|7|improve the efficiency and reliability of electrical systems|提高电气系统的效率与可靠性|meningkatkan kecekapan dan kebolehpercayaan sistem elektrik
17-2051.00|土木工程师|Jurutera Awam|11|design safer and more resilient civil infrastructure|设计更安全且具韧性的土木基础设施|mereka bentuk infrastruktur awam yang lebih selamat dan berdaya tahan
17-2112.00|工业工程师|Jurutera Industri|12|reduce waste in production processes|减少生产流程中的浪费|mengurangkan pembaziran dalam proses pengeluaran
17-3026.00|工业工程技术人员|Teknologis dan Juruteknik Kejuruteraan Industri|9|support reliable and efficient manufacturing processes|支持可靠高效的制造流程|menyokong proses pembuatan yang cekap dan boleh diharap
51-9061.00|检验、测试、分拣、取样及称重人员|Pemeriksa, Penguji, Pengasing, Pensampel dan Penimbang|12|detect defects and reduce avoidable production waste|发现缺陷并减少可避免的生产浪费|mengesan kecacatan dan mengurangkan pembaziran pengeluaran
29-1141.00|注册护士|Jururawat Berdaftar|3|deliver safe patient care and monitor health needs|提供安全护理并监测健康需求|menyampaikan penjagaan pesakit yang selamat dan memantau keperluan kesihatan
29-1123.00|物理治疗师|Ahli Fisioterapi|3|support rehabilitation and physical functioning|支持康复与身体功能恢复|menyokong pemulihan dan fungsi fizikal
29-2011.00|医学与临床实验室技术人员|Teknologis Makmal Perubatan dan Klinikal|3|produce reliable laboratory information for clinical decisions|为临床决策提供可靠的实验室信息|menghasilkan maklumat makmal yang boleh diharap bagi keputusan klinikal
29-1051.00|药剂师|Ahli Farmasi|3|support safe and appropriate medicine use|支持安全合理用药|menyokong penggunaan ubat yang selamat dan sesuai
29-1031.00|营养师|Pakar Diet dan Pemakanan|3|support evidence-informed dietary care|支持以证据为依据的膳食照护|menyokong penjagaan pemakanan berasaskan bukti
29-2072.00|医疗记录专员|Pakar Rekod Perubatan|3|improve the accuracy and usability of health records|提高健康记录的准确性与可用性|meningkatkan ketepatan dan kebolehgunaan rekod kesihatan
19-2041.00|环境科学家与专员|Saintis dan Pakar Alam Sekitar|13|investigate environmental risks and inform adaptation|调查环境风险并为适应措施提供依据|menyiasat risiko alam sekitar dan memaklumkan langkah penyesuaian
17-2081.00|环境工程师|Jurutera Alam Sekitar|6|design pollution control and water treatment solutions|设计污染控制与水处理方案|mereka bentuk kawalan pencemaran dan penyelesaian rawatan air
17-2199.11|太阳能系统工程师|Jurutera Sistem Tenaga Suria|7|design technically suitable solar energy systems|设计技术上适用的太阳能系统|mereka bentuk sistem tenaga suria yang sesuai dari segi teknikal
19-5011.00|职业健康与安全专员|Pakar Kesihatan dan Keselamatan Pekerjaan|8|identify workplace hazards and improve safe working conditions|识别工作场所危害并改善安全工作条件|mengenal pasti bahaya tempat kerja dan meningkatkan keselamatan pekerjaan
19-1031.00|自然保护科学家|Saintis Pemuliharaan|15|manage land and natural resources to protect ecosystems|通过土地与自然资源管理保护生态系统|mengurus tanah dan sumber semula jadi untuk melindungi ekosistem
47-4011.01|能源审计员|Juruaudit Tenaga|7|identify building energy losses and efficiency improvements|识别建筑能耗损失与节能改进|mengenal pasti kehilangan tenaga bangunan dan penambahbaikan kecekapan
25-2031.00|中学教师（特殊与职业教育除外）|Guru Sekolah Menengah|4|provide subject teaching and assess student learning|提供学科教学并评估学生学习|menyampaikan pengajaran mata pelajaran dan menilai pembelajaran murid
25-2032.00|中学职业技术教育教师|Guru Pendidikan Kerjaya dan Teknikal Sekolah Menengah|4|teach practical occupational skills|教授实用职业技能|mengajar kemahiran pekerjaan praktikal
25-2058.00|中学特殊教育教师|Guru Pendidikan Khas Sekolah Menengah|4|adapt teaching to learners with additional needs|为有额外需求的学生调整教学|menyesuaikan pengajaran kepada murid berkeperluan tambahan
13-1151.00|培训与发展专员|Pakar Latihan dan Pembangunan|4|assess workforce learning needs and deliver training|评估人员学习需求并实施培训|menilai keperluan pembelajaran tenaga kerja dan melaksanakan latihan
21-1012.00|教育、升学与职业咨询师|Kaunselor dan Penasihat Pendidikan dan Kerjaya|4|support informed education and career choices|支持知情的教育与职业选择|menyokong pilihan pendidikan dan kerjaya yang bermaklumat
13-1071.00|人力资源专员|Pakar Sumber Manusia|8|support fair recruitment and workforce development processes|支持公平招聘与人员发展流程|menyokong proses pengambilan adil dan pembangunan tenaga kerja
27-1024.00|平面设计师|Pereka Grafik|9|communicate useful information through accessible visual materials|通过易于理解的视觉材料传达实用信息|menyampaikan maklumat berguna melalui bahan visual yang mudah difahami
15-1255.00|Web 与数字界面设计师|Pereka Antara Muka Web dan Digital|9|make digital interfaces more usable and accessible|提高数字界面的可用性与可及性|menjadikan antara muka digital lebih mudah digunakan dan diakses
27-3042.00|技术文档撰写员|Penulis Teknikal|9|explain technical systems so people can use them safely|说明技术系统以便人们安全使用|menerangkan sistem teknikal supaya dapat digunakan dengan selamat
27-3031.00|公共关系专员|Pakar Perhubungan Awam|16|communicate accurate institutional information to the public|向公众传达准确的机构信息|menyampaikan maklumat institusi yang tepat kepada orang awam
27-4032.00|电影与视频剪辑师|Penyunting Filem dan Video|4|produce clear educational audiovisual materials when working in education|在教育项目中制作清晰的视听学习材料|menghasilkan bahan audiovisual pendidikan yang jelas dalam projek pendidikan
13-1161.01|搜索营销策略师|Ahli Strategi Pemasaran Carian|8|evaluate digital campaigns for responsible business communication|评估数字营销活动以支持负责任的商业沟通|menilai kempen digital bagi komunikasi perniagaan yang bertanggungjawab
13-1081.00|物流专员|Pakar Logistik|12|reduce avoidable transport and inventory waste|减少可避免的运输与库存浪费|mengurangkan pembaziran pengangkutan dan inventori
13-1081.02|物流分析师|Penganalisis Logistik|12|analyse supply flows to reduce resource waste|分析供应流程以减少资源浪费|menganalisis aliran bekalan bagi mengurangkan pembaziran sumber
13-1023.00|采购专员（批发、零售与农产品除外）|Ejen Pembelian|12|consider resource use when evaluating suppliers and purchases|评估供应商与采购时考虑资源使用|mempertimbangkan penggunaan sumber ketika menilai pembekal dan pembelian
15-2031.00|运筹分析师|Penganalisis Penyelidikan Operasi|9|model resource allocation to improve operational efficiency|对资源配置建模以提高运营效率|memodelkan peruntukan sumber bagi meningkatkan kecekapan operasi
43-5061.00|生产、计划与调度文员|Kerani Pengeluaran, Perancangan dan Penyelarasan|12|coordinate production schedules to limit waste and delays|协调生产计划以减少浪费与延误|menyelaras jadual pengeluaran bagi mengurangkan pembaziran dan kelewatan
53-1042.00|搬运与辅助作业一线主管|Penyelia Barisan Hadapan Pekerja Pengendalian Bahan|8|coordinate safer material handling and working practices|协调更安全的物料搬运与作业流程|menyelaras pengendalian bahan dan amalan kerja yang lebih selamat
""".strip().splitlines()

PREFERRED_TOOLS = [
    ["Python", "JavaScript", "React", "Structured query language SQL", "Linux", "Git"],
    ["Structured query language SQL", "Python", "R", "Microsoft Excel", "SAS"],
    ["Autodesk AutoCAD", "Autodesk Revit", "SolidWorks", "MATLAB", "Microsoft Excel"],
    ["Epic Systems", "MEDITECH software", "Medical software", "Microsoft Excel"],
    ["ESRI ArcGIS software", "Autodesk AutoCAD", "RETScreen", "Microsoft Excel"],
    ["Moodle", "Blackboard", "Microsoft PowerPoint", "Microsoft Excel"],
    ["Adobe Illustrator", "Adobe Photoshop", "Adobe Premiere Pro", "Figma", "Google Analytics"],
    ["SAP", "Microsoft Excel", "Structured query language SQL", "Python"],
]
TOOL_NAMES = {"Structured query language SQL": "SQL", "Microsoft Excel": "Excel"}


def local(en, zh, ms):
    return dict(en=en, zh=zh, ms=ms)


def main():
    CACHE.mkdir(exist_ok=True)
    sources, tables = [], {}
    for name in FILES:
        path = CACHE / (name + ".csv")
        if not path.exists():
            with urllib.request.urlopen(BASE + name + ".csv", timeout=60) as response:
                path.write_bytes(response.read())
        data = path.read_bytes()
        tables[name] = list(csv.DictReader(io.StringIO(data.decode("utf-8-sig"))))
        sources.append(dict(file=name + ".csv", url=BASE + name + ".csv",
                            sha256=hashlib.sha256(data).hexdigest()))
    with urllib.request.urlopen("https://www.onetcenter.org/rss/whatsnew.xml", timeout=30) as response:
        rss = ET.fromstring(response.read())
    item = next(item for item in rss.findall(".//item")
                if item.findtext("link", "").endswith("#2026082500"))
    published = parsedate_to_datetime(item.findtext("pubDate")).date().isoformat()
    assert published == "2026-08-25"
    occupations = {row["O*NET-SOC Code"]: row for row in tables["occupation_data"]}
    zones = {row["O*NET-SOC Code"]: row for row in tables["job_zones"]}
    zone_refs = {row["Job Zone"]: row for row in tables["job_zone_reference"]}
    output_rows, metadata = [], []
    for index, seed in enumerate(SEEDS):
        code, zh, ms, goal, benefit, benefit_zh, benefit_ms = seed.split("|")
        original = occupations[code]
        category = index // 6
        title = original["Title"]
        selected = []
        for name, count in [("essential_skills", 2), ("transferable_skills", 2), ("knowledge", 4)]:
            rows = sorted(
                [row for row in tables[name] if row["O*NET-SOC Code"] == code
                 and row["Scale ID"] == "IM" and row["Recommend Suppress"] != "Y"
                 and row["Not Relevant"] != "Y"],
                key=lambda row: (-float(row["Data Value"]), row["Element Name"]),
            )
            if len(rows) < count:
                raise ValueError(f"Insufficient rated source evidence: {code} {name}")
            selected.extend(dict(name=row["Element Name"], originalName=row["Element Name"],
                                 kind="knowledge" if name == "knowledge" else "skill",
                                 sourceFile=name + ".csv", elementId=row["Element ID"],
                                 dataDate=row["Date"]) for row in rows[:count])
        software = {row["Workplace Example"]: row for row in tables["software_skills"]
                    if row["O*NET-SOC Code"] == code}
        found = [name for name in PREFERRED_TOOLS[category] if name in software][:2]
        for name in found:
            selected.append(dict(name=TOOL_NAMES.get(name, name), originalName=name,
                                 kind="software", sourceFile="software_skills.csv",
                                 elementId=software[name]["Element ID"], dataDate=None))
        # Mathematics, for example, occurs as both a skill and a knowledge
        # domain. Keep one matchable item rather than double-counting it.
        selected = list({s["name"].casefold(): s for s in selected}.values())
        assert len(selected) >= 6
        zone = zones[code]["Job Zone"]
        domain_skill = next(s["name"] for s in selected if s["kind"] == "knowledge")
        rationale = local(
            f"When applied to {benefit}, knowledge of {domain_skill} can support SDG {goal}. "
            "This is an app-authored intended contribution, not a measured outcome or UN endorsement.",
            f"若用于{benefit_zh}，{domain_skill}相关知识可支持 SDG {goal}。"
            "这是项目编写的预期贡献说明，不是已测量成效，也不代表联合国认可。",
            f"Apabila digunakan untuk {benefit_ms}, pengetahuan {domain_skill} boleh menyokong SDG {goal}. "
            "Ini sumbangan yang dicadangkan oleh aplikasi, bukan impak terukur atau pengendorsan PBB.",
        )
        metadata.append(dict(
            id="onet-" + code, occupation=title, onetCode=code,
            labels=local(title, zh, ms), category=local(*CATEGORIES[category]),
            description=original["Description"], descriptionLanguage="en",
            jobZone=int(zone), entryEducation=zone_refs[zone]["Education"],
            entryExperience=zone_refs[zone]["Experience"],
            entryDataDate=zones[code]["Date"],
            sourceUrl="https://www.onetonline.org/link/summary/" + code,
            jurisdiction="United States", trendEvidenceStatus="unknown",
            sdgs=[dict(goal=int(goal), skills=[domain_skill], rationale=rationale)],
            skills=selected,
        ))
        for skill in selected:
            output_rows.append(dict(
                occupation=title, skill=skill["name"], trend_direction="stable",
                source_name="O*NET 31.0 Database — USDOL/ETA",
                source_url=BASE + skill["sourceFile"], publication_date=published,
                evidence=f'O*NET-SOC {code}; {skill["sourceFile"]}; '
                         f'{skill["elementId"]}; source label: {skill["originalName"]}. '
                         "Verified occupation association only. No trend evidence; stable is a neutral compatibility placeholder.",
                record_status="verified",
            ))
    assert len(metadata) == 48 and len({row["onetCode"] for row in metadata}) == 48
    catalog = dict(
        schemaVersion=1, version="O*NET 31.0", publishedOn=published,
        checkedOn=datetime.now(timezone.utc).date().isoformat(),
        releaseUrl=item.findtext("link"), licenseUrl="https://creativecommons.org/licenses/by/4.0/",
        attribution="O*NET 31.0 Database, U.S. Department of Labor, Employment and Training Administration (USDOL/ETA), CC BY 4.0. "
                    "FuturePath selected a subset, standardized two software labels, and added translations, categories and conditional SDG interpretations. "
                    "USDOL/ETA has not approved, endorsed, or tested these modifications.",
        selectionMethod="Top 2 essential skills, top 2 transferable skills and top 4 knowledge domains by unsuppressed importance rating; "
                        "up to 2 explicitly listed software examples. App-selected subset, not a complete employer requirements list. "
                        "Importance ratings are not used as matching weights. No wage, growth or demand prediction.",
        sources=sources, occupations=metadata,
    )
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with (OUTPUT / "official-occupations.csv").open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(output_rows[0]))
        writer.writeheader()
        writer.writerows(output_rows)
    METADATA_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    METADATA_OUTPUT.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")
    print(f"Generated {len(metadata)} occupations and {len(output_rows)} sourced associations.")
    print(f"Release: {published}; checked: {catalog['checkedOn']}; no trend verified.")


if __name__ == "__main__":
    main()
