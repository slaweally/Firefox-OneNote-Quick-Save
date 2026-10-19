using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;
using System.Xml.Linq;
using System.Globalization;

internal static class Program
{
    private const int MaxMessageBytes = 16 * 1024 * 1024;
    private static readonly XNamespace OneNote =
        "http://schemas.microsoft.com/office/onenote/2013/onenote";
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();

    [STAThread]
    private static int Main()
    {
        try
        {
            using (var input = Console.OpenStandardInput())
            using (var output = Console.OpenStandardOutput())
            {
                var header = ReadExactly(input, 4);
                var length = BitConverter.ToInt32(header, 0);
                if (length <= 0 || length > MaxMessageBytes)
                    throw new InvalidDataException("Geçersiz ileti boyutu.");

                var payload = ReadExactly(input, length);
                var request = Json.Deserialize<Dictionary<string, object>>(
                    Encoding.UTF8.GetString(payload));

                object response;
                try
                {
                    response = Handle(request);
                }
                catch (Exception ex)
                {
                    response = new Dictionary<string, object>
                    {
                        { "ok", false },
                        { "error", GetUsefulMessage(ex) }
                    };
                }

                WriteResponse(output, response);
            }

            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex);
            return 1;
        }
    }

    private static object Handle(Dictionary<string, object> request)
    {
        var appType = Type.GetTypeFromProgID("OneNote.Application");
        if (appType == null)
            throw new InvalidOperationException(
                "OneNote masaüstü uygulaması bulunamadı. Microsoft 365 OneNote'u yükleyip açın.");

        object app;
        try
        {
            app = Activator.CreateInstance(appType);
        }
        catch (COMException exception)
        {
            throw new InvalidOperationException(
                "OneNote başlatılamadı. Microsoft 365 OneNote masaüstü uygulamasının yüklü ve açılabilir olduğunu doğrulayın. "
                + exception.Message,
                exception);
        }
        try
        {
            var command = GetString(request, "command");
            if (command == "listPages")
                return new Dictionary<string, object>
                {
                    { "ok", true },
                    { "pages", ListPages(app) }
                };
            if (command == "listSections")
                return new Dictionary<string, object>
                {
                    { "ok", true },
                    { "sections", ListSections(app) }
                };
            if (command == "append")
                return Append(app, request);
            if (command == "createPage")
                return CreatePage(app, request);

            throw new InvalidDataException("Desteklenmeyen komut.");
        }
        finally
        {
            if (Marshal.IsComObject(app))
                Marshal.FinalReleaseComObject(app);
        }
    }

    private static List<Dictionary<string, object>> ListPages(object app)
    {
        var hierarchyArgs = new object[] { "", 4, null, 2 };
        InvokeOneNote(app, "GetHierarchy", hierarchyArgs);
        var hierarchyXml = (string)hierarchyArgs[2];
        var hierarchy = XDocument.Parse(hierarchyXml);
        var pages = new List<Dictionary<string, object>>();

        foreach (var notebook in hierarchy.Descendants(OneNote + "Notebook"))
        {
            var notebookName = (string)notebook.Attribute("name") ?? "Not defteri";
            foreach (var section in notebook.Descendants(OneNote + "Section"))
            {
                var sectionName = (string)section.Attribute("name") ?? "Bölüm";
                foreach (var page in section.Elements(OneNote + "Page"))
                {
                    var id = (string)page.Attribute("ID");
                    if (String.IsNullOrWhiteSpace(id))
                        continue;

                    pages.Add(new Dictionary<string, object>
                    {
                        { "id", id },
                        { "title", (string)page.Attribute("name") ?? "Başlıksız sayfa" },
                        { "notebook", notebookName },
                        { "section", sectionName }
                    });
                }
            }
        }

        return pages;
    }

    private static List<Dictionary<string, object>> ListSections(object app)
    {
        var hierarchyArgs = new object[] { "", 3, null, 2 };
        InvokeOneNote(app, "GetHierarchy", hierarchyArgs);
        var hierarchy = XDocument.Parse((string)hierarchyArgs[2]);
        var sections = new List<Dictionary<string, object>>();

        foreach (var section in hierarchy.Descendants(OneNote + "Section"))
        {
            var id = (string)section.Attribute("ID");
            if (String.IsNullOrWhiteSpace(id))
                continue;

            var notebook = section.Ancestors(OneNote + "Notebook").FirstOrDefault();
            var groups = section.Ancestors(OneNote + "SectionGroup")
                .Reverse()
                .Select(group => (string)group.Attribute("name"))
                .Where(name => !String.IsNullOrWhiteSpace(name));
            var groupPath = String.Join(" / ", groups);
            sections.Add(new Dictionary<string, object>
            {
                { "id", id },
                { "name", (string)section.Attribute("name") ?? "Bölüm" },
                { "notebook", notebook == null ? "Not defteri" : (string)notebook.Attribute("name") ?? "Not defteri" },
                { "group", groupPath }
            });
        }

        return sections;
    }

    private static object Append(object app, Dictionary<string, object> request)
    {
        var pageId = GetString(request, "pageId");
        var text = GetString(request, "text") ?? String.Empty;
        var imageData = GetString(request, "imageData");

        if (String.IsNullOrWhiteSpace(pageId))
            throw new InvalidDataException("OneNote hedef sayfası seçilmedi.");
        if (String.IsNullOrWhiteSpace(text) && String.IsNullOrWhiteSpace(imageData))
            throw new InvalidDataException("Eklenecek metin veya görüntü yok.");
        if (text.Length > 1000000)
            throw new InvalidDataException("Metin izin verilen boyutu aşıyor.");

        var hierarchyArgs = new object[] { "", 4, null, 2 };
        InvokeOneNote(app, "GetHierarchy", hierarchyArgs);
        var hierarchyXml = (string)hierarchyArgs[2];
        var hierarchy = XDocument.Parse(hierarchyXml);
        var page = hierarchy.Descendants(OneNote + "Page")
            .FirstOrDefault(node => String.Equals(
                (string)node.Attribute("ID"), pageId, StringComparison.OrdinalIgnoreCase));
        if (page == null)
            throw new InvalidOperationException("Seçilen sayfa artık mevcut değil; sayfa listesini yenileyin.");

        var pageContentArgs = new object[] { pageId, null, 0, 2 };
        InvokeOneNote(app, "GetPageContent", pageContentArgs);
        var pageContentXml = (string)pageContentArgs[1];
        var pageContent = XDocument.Parse(pageContentXml);
        var nextY = 160.0;
        foreach (var item in pageContent.Root.Elements())
        {
            var position = item.Element(OneNote + "Position");
            var size = item.Element(OneNote + "Size");
            double y;
            double height;
            if (position != null
                && size != null
                && Double.TryParse((string)position.Attribute("y"), NumberStyles.Float,
                    CultureInfo.InvariantCulture, out y)
                && Double.TryParse((string)size.Attribute("height"), NumberStyles.Float,
                    CultureInfo.InvariantCulture, out height))
            {
                nextY = Math.Max(nextY, y + height + 30);
            }
        }

        var outline = BuildOutline(text, imageData, nextY);

        var changes = new XDocument(
            new XDeclaration("1.0", "utf-8", null),
            new XElement(OneNote + "Page",
                new XAttribute("ID", (string)page.Attribute("ID")),
                outline));

        InvokeOneNote(app, "UpdatePageContent",
            changes.ToString(SaveOptions.DisableFormatting), 0, 2, false);
        return new Dictionary<string, object> { { "ok", true } };
    }

    private static object CreatePage(object app, Dictionary<string, object> request)
    {
        var sectionId = GetString(request, "sectionId");
        var title = NormalizePageTitle(GetString(request, "title"));
        var text = GetString(request, "text") ?? String.Empty;
        var imageData = GetString(request, "imageData");

        if (String.IsNullOrWhiteSpace(sectionId))
            throw new InvalidDataException("OneNote hedef bölümü seçilmedi.");
        if (String.IsNullOrWhiteSpace(text) && String.IsNullOrWhiteSpace(imageData))
            throw new InvalidDataException("Eklenecek metin veya görüntü yok.");
        if (text.Length > 1000000)
            throw new InvalidDataException("Metin izin verilen boyutu aşıyor.");

        var hierarchyArgs = new object[] { "", 3, null, 2 };
        InvokeOneNote(app, "GetHierarchy", hierarchyArgs);
        var hierarchy = XDocument.Parse((string)hierarchyArgs[2]);
        if (!hierarchy.Descendants(OneNote + "Section").Any(section =>
            String.Equals((string)section.Attribute("ID"), sectionId, StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException("Seçilen OneNote bölümü bulunamadı; bölümleri yenileyin.");
        }

        var createArgs = new object[] { sectionId, null, 0 };
        InvokeOneNote(app, "CreateNewPage", createArgs);
        var pageId = createArgs[1] as string;
        if (String.IsNullOrWhiteSpace(pageId))
            throw new InvalidOperationException("OneNote yeni sayfanın kimliğini döndürmedi.");

        var page = new XElement(OneNote + "Page",
            new XAttribute("ID", pageId),
            new XElement(OneNote + "Title",
                new XElement(OneNote + "OE",
                    new XAttribute("alignment", "left"),
                    new XElement(OneNote + "T", title))),
            BuildOutline(text, imageData, 160));
        var changes = new XDocument(
            new XDeclaration("1.0", "utf-8", null),
            page);
        InvokeOneNote(app, "UpdatePageContent",
            changes.ToString(SaveOptions.DisableFormatting), 0, 2, false);
        return new Dictionary<string, object> { { "ok", true }, { "pageId", pageId }, { "title", title } };
    }

    private static XElement BuildOutline(string text, string imageData, double y)
    {
        var outline = new XElement(OneNote + "Outline",
            new XElement(OneNote + "Position",
                new XAttribute("x", "120"),
                new XAttribute("y", y.ToString(CultureInfo.InvariantCulture))),
            new XElement(OneNote + "Size",
                new XAttribute("width", "500"),
                new XAttribute("height", "50")),
            new XElement(OneNote + "OEChildren"));

        var children = outline.Element(OneNote + "OEChildren");
        foreach (var line in (text ?? String.Empty).Replace("\r\n", "\n").Replace('\r', '\n').Split('\n'))
        {
            if (String.IsNullOrEmpty(line))
                continue;
            children.Add(new XElement(OneNote + "OE",
                new XElement(OneNote + "T", line)));
        }

        if (!String.IsNullOrWhiteSpace(imageData))
        {
            const string prefix = "data:image/png;base64,";
            if (!imageData.StartsWith(prefix, StringComparison.Ordinal))
                throw new InvalidDataException("Görüntü biçimi PNG olmalıdır.");

            var imageBytes = Convert.FromBase64String(imageData.Substring(prefix.Length));
            if (imageBytes.Length > 8 * 1024 * 1024)
                throw new InvalidDataException("Görüntü 8 MB sınırını aşıyor.");

            children.Add(new XElement(OneNote + "OE",
                new XElement(OneNote + "Image",
                    new XAttribute("format", "png"),
                    new XElement(OneNote + "Data", Convert.ToBase64String(imageBytes)))));
        }

        return outline;
    }

    private static string NormalizePageTitle(string title)
    {
        var normalized = String.IsNullOrWhiteSpace(title) ? "Firefox notu" : title.Trim();
        normalized = new String(normalized
            .Where(character => !Char.IsControl(character))
            .ToArray());
        if (String.IsNullOrWhiteSpace(normalized))
            normalized = "Firefox notu";
        return normalized.Length > 150 ? normalized.Substring(0, 150).Trim() : normalized;
    }

    private static object InvokeOneNote(object app, string methodName, params object[] arguments)
    {
        var interfaceType = app.GetType().GetInterfaces()
            .FirstOrDefault(type => type.Name == "IApplicationCOM");
        if (interfaceType == null)
            throw new MissingMethodException("OneNote otomasyon arayüzü bulunamadı.");

        var candidates = interfaceType.GetMethods()
            .Where(candidate => candidate.Name == methodName
                && candidate.GetParameters().Length == arguments.Length)
            .ToArray();
        if (candidates.Length != 1)
            throw new MissingMethodException("OneNote arayüzünde yöntem bulunamadı: " + methodName);

        var method = candidates[0];
        var parameters = method.GetParameters();
        for (var i = 0; i < parameters.Length; i++)
        {
            var parameterType = parameters[i].ParameterType;
            if (parameterType.IsByRef)
                parameterType = parameterType.GetElementType();
            if (arguments[i] != null && parameterType.IsEnum
                && arguments[i].GetType() != parameterType)
                arguments[i] = Enum.ToObject(parameterType, arguments[i]);
            else if (parameterType == typeof(DateTime) && arguments[i] is int)
                arguments[i] = DateTime.FromOADate((int)arguments[i]);
        }

        return method.Invoke(app, arguments);
    }

    private static string GetString(Dictionary<string, object> request, string key)
    {
        object value;
        return request != null && request.TryGetValue(key, out value)
            ? value as string
            : null;
    }

    private static string GetUsefulMessage(Exception exception)
    {
        while (exception is System.Reflection.TargetInvocationException
            && exception.InnerException != null)
            exception = exception.InnerException;

        if (exception is COMException)
        {
            var comException = (COMException)exception;
            return String.Format(
                "OneNote masaüstü otomasyonu hata verdi (0x{0:X8}): {1}",
                comException.ErrorCode,
                comException.Message);
        }
        return exception.Message;
    }

    private static byte[] ReadExactly(Stream stream, int length)
    {
        var bytes = new byte[length];
        var offset = 0;
        while (offset < length)
        {
            var read = stream.Read(bytes, offset, length - offset);
            if (read == 0)
                throw new EndOfStreamException("Native messaging isteği tamamlanmadı.");
            offset += read;
        }

        return bytes;
    }

    private static void WriteResponse(Stream output, object response)
    {
        var bytes = Encoding.UTF8.GetBytes(Json.Serialize(response));
        output.Write(BitConverter.GetBytes(bytes.Length), 0, 4);
        output.Write(bytes, 0, bytes.Length);
        output.Flush();
    }
}
