function convertUrlToFolder(url) {
  // Split the URL into its parts
  let urlParts = url.split("/");
  let protocol = urlParts[0].replace(':',':');
  let domain = urlParts.slice(2, -1).join("/");
  let file = urlParts[urlParts.length - 1];

  // Create the folder structure
  let folderStructure = protocol + "/" + domain + "/" + file;

  return /*"<!--original url: "+ url +"-->\n" +*/ folderStructure;
}



function convertAllUrlsToFolderStructure(htmlString) {
  let newHtmlString = htmlString;
  let regEx = /(https?):\/\/[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+/gi;
  let matches = newHtmlString.match(regEx);
  if(matches){
    matches.forEach(function(url) {
      let folderStructure = convertUrlToFolder(url);
      newHtmlString = newHtmlString.replace(url, folderStructure);
    });
  }
  return newHtmlString;
}



function extractLinks(htmlString, baseUrl) {
  const parser = new DOMParser({ baseUrl });
  const doc = parser.parseFromString(htmlString, "text/html");
  const base = new URL(baseUrl);
  //console.log(base)
  const elementTypes = ["img", "audio", "video", "link[rel='stylesheet']", "script"];
  const links = {
    images: [],
    audios: [],
    videos: [],
    css: [],
    js: []
  };

  elementTypes.forEach((elementType, index) => {
    const elements = Array.from(doc.querySelectorAll(elementType));
    elements.forEach(element => {
      let link;
      if (elementType === "link[rel='stylesheet']") {
        link = element.href;
      } else {
        link = element.src;
      }
      const currentBaseUrl = new URL(window.location.href).origin;

      link = link.replace(currentBaseUrl+'/', "");
      let isBlank = false
      if (!link) isBlank = true
      if (!(link.startsWith("http://") || link.startsWith("https://"))) {
        link = base + link;
      }
      if (!isBlank) links[Object.keys(links)[index]].push(link);
    });
  });

  return links;
}

function createZip(htmlString, baseUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");
  const resources = extractLinks(htmlString, baseUrl);
console.log(resources)
  const zip = new JSZip();

  let resourcePromises = []
  for (let key in resources) {
    resources[key].forEach(resource => {
      resourcePromises.push(fetchViaProxy(resource)
        .then(response => {
          if(!response.ok) console.log('not ok', response.status ,resource)
            switch (key) {
                case "images":
                    return response.blob();
                case "audios":
                case "videos":
                    return response.arrayBuffer();
                case "css":
                case "js":
                  console.log(response.headers.get("content-type"));
                  //  console.log(response.text().then(a=>console.log(a)))
                    return response.blob();
                default:
                console.log('err')
                    return response.arrayBuffer();
            }
        }))
    });
  }

return  Promise.all(resourcePromises)
    .then(data => {
let i = 0
      for (let key in resources) {
              
        resources[key].forEach((resource) => {
         // console.log(a, key)
          zip.file(resource.replace(baseUrl,''),
          data[i]);
                    console.log(resource.replace(baseUrl, ''),
                      data[i]);
          i++
        });
      }
      zip.file("index.html", htmlString);
      return zip.generateAsync({ type: "blob" })
    })
    .then(content => {
      saveAs(content, "resources.zip");
      return content
    });

}


async function fetchViaProxy(url) {
  try {
    const proxyUrl = 'https://corsproxy.io/?';
    const targetUrl = url;
    const proxiedUrl = proxyUrl + encodeURIComponent(targetUrl);

    const response = await fetch(proxiedUrl);
    //const data = await response.text();
    return response;
  } catch (error) {
    console.error(error);
  }
}

async function main() {
  const gameStartUrl = 'https://cute-timetable.vercel.app/'
  const response = await fetchViaProxy(gameStartUrl)
  const data = await response.text()
  console.log(convertAllUrlsToFolderStructure(data))
  console.log(await createZip(data,gameStartUrl.replace('index.html', '') ))
  console.log(extractLinks(data, gameStartUrl.replace('index.html', '')))
}

main()