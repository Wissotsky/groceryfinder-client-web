console.log("Starting");


function updateItemList(){
  let STATEstoreId = window.selectedStoreId;
  let STATEitemsListDiv = document.getElementById(window.CONTENT_ELEMENT_ID);
  let STATEitemsData = window.ItemsData;
  let STATEselectedItems = window.selectedItems;
  // initializing an array going from 0 to N, given N is the global amount of items
  let itemIdArray = Array.from(Array(STATEitemsData.itemNames.length).keys())
  // fetch store items
  // filterItemsByStoreId(itemIdArray,storeId,globalItemsData)
  let storeItemIdArray = Utils.filterItemsByStoreId(itemIdArray,STATEstoreId,STATEitemsData);
  // htmlStoreItemList(storeitems,storeId,ItemsData,selectedItems)
  let storeHtml = htmlStoreItemList(storeItemIdArray,STATEstoreId,STATEitemsData,STATEselectedItems);
  STATEitemsListDiv.replaceChildren(storeHtml);
}

function renderMapSelectedItemPrices(mapStore2Price) {
  let GLOBALstoresData = window.StoresData
  let GLOBALmap = window.map
  
  let minPrice = Math.min(...mapStore2Price.values())
  let maxPrice = Math.max(...mapStore2Price.values())
  
  const coordinatesData = {
    'type': 'FeatureCollection',
    'features': [] // This should be filled with your coordinates data
  };
  for (var i=0; i < GLOBALstoresData.storeIds.length; i++) {
    let storeId = GLOBALstoresData.storeIds[i];
    if (mapStore2Price.has(storeId) && (mapStore2Price.get(storeId) !== 0)) {
      let storeLng = GLOBALstoresData.storeLongitudes[i]
      let storeLat = GLOBALstoresData.storeLatitudes[i]
      let value = mapStore2Price.get(storeId)
      // price position
      let normPrice = (value - minPrice)/(maxPrice - minPrice)

      window.map.setFeatureState({source: 'storeMarkers', id: storeId}, { normalizedPrice: normPrice });

      const feature = {
          'type': 'Feature',
          'geometry': {
              'type': 'Point',
              'coordinates': [storeLng, storeLat]
          },
          'properties': {
            'value':`${value/100}`,
            'normalizedPrice': normPrice
          }
      };
      coordinatesData.features.push(feature);
    } else {
      window.map.setFeatureState({source: 'storeMarkers', id: storeId}, { normalizedPrice: -1 });
    }
  }
  console.log(coordinatesData)
  GLOBALmap.getSource('priceMarkers').setData(coordinatesData);
}

function utilSelectedItemsPrice(itemIdxs, itemCounts, hiddenItemIdxs) {
  let GLOBALStoresData = window.StoresData;
  let GLOBALItemData = window.ItemsData;
  
  let output = new Map();
  iterationOverAllStores: for (let storeId of GLOBALStoresData.storeIds) {
    let accumulatedPriceForStore = 0;
    for (let itemIdx of itemIdxs) {
      if (Array.isArray(itemIdx)) {
        if (itemIdx.length === 0) { continue; } // if array is empty skip it
        if (itemIdx.filter(x => !hiddenItemIdxs.has(x)).length === 0) { continue; } // if array is empty after removing hidden items from it, skip it.
        let localLowestPrice = Infinity;
        for (let subItemIdx of itemIdx) {
          if (hiddenItemIdxs.has(subItemIdx)) { continue; } // if item is hidden skip it
          let indexOfStorePrice = GLOBALItemData.itemPricingData[subItemIdx].stores.indexOf(storeId);
          if (indexOfStorePrice !== -1) {
            let itemCount = itemCounts.has(String(subItemIdx)) ? itemCounts.get(String(subItemIdx)) : 1;
            let localItemPrice = (GLOBALItemData.itemPricingData[subItemIdx].pricesAtStores[indexOfStorePrice] * itemCount);
            if (localItemPrice < localLowestPrice) {
              localLowestPrice = localItemPrice;
            }
          }
        }
        if (localLowestPrice === Infinity) {
          continue iterationOverAllStores;
        }
        accumulatedPriceForStore = localLowestPrice;
      } else {
        if (hiddenItemIdxs.has(itemIdx)) { continue; }
        let indexOfStorePrice = GLOBALItemData.itemPricingData[itemIdx].stores.indexOf(storeId);
        if (indexOfStorePrice !== -1) {
          let itemCount = itemCounts.has(String(itemIdx)) ? itemCounts.get(String(itemIdx)) : 1;
          accumulatedPriceForStore += (GLOBALItemData.itemPricingData[itemIdx].pricesAtStores[indexOfStorePrice] * itemCount);
        } else {
          continue iterationOverAllStores;
        }
      }
    }  
    output.set(storeId,accumulatedPriceForStore);
  }
  
  console.log(output);
  return output;
}

function utilHighlightSubstring(String,SubString) {
  SubString = SubString.trim();
  let index = String.indexOf(SubString);
  let fragment = new DocumentFragment();
  let highlightedString = String;
  if (index !== -1) {
    let prefixText = String.slice(0, index);
    let substringSlice = String.slice(index, index + SubString.length)
    let markedText = document.createElement("mark");
      markedText.textContent = substringSlice
    let postfixText = String.slice(index + SubString.length);
    
    fragment.append(prefixText);
    if (substringSlice.length > 0) {
      fragment.append(markedText);
    }
    fragment.append(postfixText);
    //highlightedString = String.slice(0, index) + '<mark>' + String.slice(index, index + SubString.length) + '</mark>' + String.slice(index + SubString.length);
  } else {
    fragment.append(String);
  }
  return fragment
}

//
// HTML constructors
//


function htmlStoreItemList(storeItems,storeId,globalItemList,selectedItems) {
  let STATEwindowHeight = document.getElementById("scroll-pane").getBoundingClientRect().height;
  let STATEscrollPosition = 0 //TEMP PATCH
  let STATEscrollTop = document.getElementById("scroll-pane").scrollTop
  let STATEremToPixels = parseInt(getComputedStyle(document.documentElement).fontSize);
  let STATEcontentSize = 6*STATEremToPixels;
  let STATEsearchterm = searchbox.value;
  
  let fragment = new DocumentFragment();
  
  let storeName = document.getElementById("small-text");
    storeName.textContent = StoresData.storeNames[StoresData.storeIds.indexOf(storeId)];
  
  // apply search to store items
  storeItems = Utils.filterItemsBySearchQuery(storeItems,STATEsearchterm,globalItemList)

  let approximatedTableHeight = (storeItems.length)*STATEcontentSize;
  console.log(approximatedTableHeight)
  
  let tableNode = document.createElement("div");
  
  // preslice the array instead of doing it inside the forEach loop
  // more predictable to the js engine if theres no branching inside the forEach loop
  let highestItem = Math.floor(STATEscrollTop/STATEcontentSize)
  let lowestItem = Math.ceil((STATEscrollTop+STATEwindowHeight)/STATEcontentSize)
  console.log(highestItem,lowestItem);
  
  let filteredStoreItems = storeItems.slice(highestItem,lowestItem)
  
  var iter = highestItem-1;
  filteredStoreItems.forEach(itemIdx => {
    iter++
    console.log(iter)
      let itemId = globalItemList.itemIds[itemIdx];
    
      let itemName = globalItemList.itemNames[itemIdx];
      let stringItemName = utilHighlightSubstring(itemName,STATEsearchterm);

      let stringItemUnit = "TODO: units"

      // figure out and format item prices
      let itemStores = globalItemList.itemPricingData[itemIdx]
      let itemPrices = itemStores.pricesAtStores[itemStores.stores.indexOf(storeId)]

      let isOnePrice = true
      let numPriceLow = itemPrices/100
      let numPriceHigh = undefined
      
      let boolIsChecked = selectedItems.flat().includes(Number(itemIdx));

      // usecase options
      let numItemMultiplier = undefined
      let hasButtons = false
      let isVisibilityControl = false
      let isDoubleDeleted = undefined
      let isInGroup = undefined
      
      // fragmentItemEntry(itemId,itemIdx,boolIsChecked,stringItemName,stringItemUnit,numItemMultiplier,numPriceLow,numPriceHigh,hasButtons,isVisibilityControl,isDoubleDeleted,isInGroup,isOnePrice)
      let fragmentItemCard = FragmentConstructor.fragmentItemEntry(itemId,itemIdx,boolIsChecked,stringItemName,stringItemUnit,numItemMultiplier,numPriceLow,numPriceHigh,hasButtons,isVisibilityControl,isDoubleDeleted,isInGroup,isOnePrice);

      // FragmentConstructor.itemCardConstructor(itemId,itemName,isInCart,itemPrice,isRangeOfPrices)
      // let fragmentItemCard = FragmentConstructor.itemCardConstructor(itemId,highlightedItemName,isItemInCart,itemPrice,false);
      
      //let divItemCard = fragmentItemCard.firstElementChild;
      
      if (!itemStores.stores.includes(storeId)) {
        fragmentItemCard.setAttribute("style",`opacity:0.18; position:absolute; top:${iter*STATEcontentSize}px; width:100%;`);
        fragmentItemCard.setAttribute("data-tooltip","Item Not Present In Store");
      } else {
        fragmentItemCard.setAttribute("style",`position:absolute; top:${iter*STATEcontentSize}px; width:100%;`);
      }
      
      tableNode.append(fragmentItemCard);
    
  });

  tableNode.setAttribute("style",`position:relative; width:100%; height:${approximatedTableHeight}px;`);
  
  fragment.append(tableNode);
  
  return fragment
}

function htmlGlobalItemList(globalItemList,cartItems,searchParameters) {
  let STATEwindowHeight = document.getElementById("scroll-pane").getBoundingClientRect().height;
  let STATEscrollTop = document.getElementById("scroll-pane").scrollTop
  let STATEremToPixels = parseInt(getComputedStyle(document.documentElement).fontSize);
  let STATEcontentSize = 6*STATEremToPixels;
  let STATEsearchterm = searchbox.value;
  
  let len = globalItemList.itemNames.length;
  let itemIdArray = new Uint32Array(len);
  for (let i = 0; i < len; i++) {
      itemIdArray[i] = i;
  }
  // filterItemsBySearchQuery(itemIdArray,searchQuery,globalItemsData)
  let searchedObjects = Utils.filterItemsBySearchQuery(itemIdArray,STATEsearchterm,globalItemList)
  
  let approximatedTableHeight = (searchedObjects.length)*STATEcontentSize;
  
  let fragment = new DocumentFragment();
  fragment.append(document.createElement("p").textContent = "Global List");
  let tableNode = document.createElement("div");
  
  // preslice the array instead of doing it inside the forEach loop
  // more predictable to the js engine if theres no branching inside the forEach loop
  
  let highestItem = Math.floor(STATEscrollTop/STATEcontentSize)
  let lowestItem = Math.ceil((STATEscrollTop+STATEwindowHeight)/STATEcontentSize)
  let filteredObjects = searchedObjects.slice(highestItem,lowestItem)
  
  var iter = highestItem-1;
  filteredObjects.forEach(itemIdx => {
    iter++
    
    let itemId = globalItemList.itemIds[itemIdx];
    
    let itemName = globalItemList.itemNames[itemIdx];
    let stringItemName = utilHighlightSubstring(itemName,STATEsearchterm);
    
    let stringItemUnit = "TODO: units"
    
    // figure out and format item prices
    let itemPrices = globalItemList.itemPricingData[itemIdx].pricesAtStores
    let minItemPrice = Number.MAX_SAFE_INTEGER
    let maxItemPrice = Number.MIN_SAFE_INTEGER 
    
    for (let i=0; i<itemPrices.length; i++) {
      let price = itemPrices[i];
      if (price < minItemPrice) { minItemPrice = price }
      if (price > maxItemPrice) { maxItemPrice = price }
    }
    let isOnePrice = (minItemPrice === maxItemPrice)
    let numPriceLow = minItemPrice/100
    let numPriceHigh = maxItemPrice/100
    
    let boolIsChecked = cartItems.flat().includes(Number(itemIdx));

    // usecase options
    let numItemMultiplier = undefined
    let hasButtons = false
    let isVisibilityControl = false
    let isDoubleDeleted = undefined
    let isInGroup = undefined
    // fragmentItemEntry(itemId,itemIdx,boolIsChecked,stringItemName,stringItemUnit,numItemMultiplier,numPriceLow,numPriceHigh,hasButtons,isVisibilityControl,isDoubleDeleted,isInGroup,isOnePrice) {
    let fragmentItemCard = FragmentConstructor.fragmentItemEntry(itemId,itemIdx,boolIsChecked,stringItemName,stringItemUnit,numItemMultiplier,numPriceLow,numPriceHigh,hasButtons,isVisibilityControl,isDoubleDeleted,isInGroup,isOnePrice);
    //let fragmentItemCard = FragmentConstructor.itemCardConstructor(itemId,highlightedItemName,isItemInCart,itemPrices,true);
    //let divItemCard = fragmentItemCard.firstElementChild;
        
    fragmentItemCard.setAttribute("style",`position:absolute; top:${iter*STATEcontentSize}px; width:100%;`);
      
    tableNode.append(fragmentItemCard);
    
  });
  
  tableNode.setAttribute("style",`position:relative; width:100%; height:${approximatedTableHeight}px;`);
  fragment.append(tableNode);
  return fragment
}

function globalDiscountList() {
  let fragment = new DocumentFragment();
  let divNode = document.createElement("div");
  let GLOBALDiscountData = window.PromoData
  
  for (var i=0; i < GLOBALDiscountData.promoIds.length; i++) {
    let description = GLOBALDiscountData.promoDescription[i]
    let rate = GLOBALDiscountData.promoDiscountRate[i]
    let price = GLOBALDiscountData.promoDiscountedPrice[i]
    let endtime = GLOBALDiscountData.promoEndUnixTime[i]
    
    let relativeTimeString = new Intl.RelativeTimeFormat().format((new Date(endtime*1000) - new Date()) / (24*60*60*1000),'day') 
    //console.log(i);
    
    
    let pRow = document.createElement("article");
      pRow.append(description);
      let newlineBreak = document.createElement("br");
      pRow.append(newlineBreak);
      pRow.append(`${rate}%`);
      newlineBreak = document.createElement("br");
      pRow.append(newlineBreak);
      pRow.append(`${price/100}\₪`);
      newlineBreak = document.createElement("br");
      pRow.append(newlineBreak);
      pRow.append(`Expiry: ${relativeTimeString}`);
    

    divNode.append(pRow);
    let horizontalBreak = document.createElement("hr");
    divNode.append(horizontalBreak);
  }

  fragment.append(divNode);
  return fragment
}


/*
  <a class="row padding">
    <div class="max">
      <h6 class="small">Promotion name that is way too long</h6>
      <div>Expires: in 10 days</div>
    </div>
    <label class="chip primary round">18₪</label>
  </a>

  <a class="row padding">
    <div class="max">
      <h6 class="small">Promotion name that is way too long</h6>
      <div>Expires: in 270 days</div>
    </div>
    <label class="chip tertiary round">10%</label>
  </a>

  <a class="row padding">
    <div class="max">
      <h6 class="small">Promotion name that is way too long</h6>
      <div>Expires: in 10 days</div>
    </div>
    <label class="chip primary round">18₪</label>
  </a>
</dialog>

<dialog class="right large active">
  <header class="fixed front">
    <nav>
      <div class="max truncate">
        <h5>Item Name</h5>
      </div>
      <button class="circle transparent"><i>close</i></button>
    </nav>
  </header>
  
  <p>Barcode: 5906485301012</p>
  <p>Store Count: 1098</p>
  <img class="small-width small-height" src="/favicon.png">

*/

function itemDiscountList(itemId,itemIdx) {
  let fragment = new DocumentFragment();
  let divNode = document.createElement("div");
  let GLOBALDiscountData = window.PromoData;
  let GLOBALItemsData = window.ItemsData;
  
  console.log(`Drawing details for Item Index ${itemIdx}`)
  
  let itemNameElem = document.createElement("h5");
    itemNameElem.append(GLOBALItemsData.itemNames[itemIdx]);
  let itemNameDiv = document.createElement("div");
    itemNameDiv.setAttribute("class", "max truncate");
    itemNameDiv.append(itemNameElem);
  
  let btnCloseIcon = document.createElement("i");
    btnCloseIcon.append("close");
  let btnCloseElem = document.createElement("button");
    btnCloseElem.setAttribute("class","circle transparent");
    btnCloseElem.setAttribute("data-ui","#dialog")
    btnCloseElem.append(btnCloseIcon);
  
  let headerNav = document.createElement("nav");
    headerNav.append(itemNameDiv);
    headerNav.append(btnCloseElem);
  let headerElem = document.createElement("header");
    headerElem.setAttribute("class","fixed front");
    headerElem.append(headerNav);
  
  let itemOffLink = document.createElement("a");
    itemOffLink.setAttribute("class","link");
    itemOffLink.setAttribute("href",`https://world.openfoodfacts.org/product/${itemId}`);
    itemOffLink.setAttribute("target","_blank");
    itemOffLink.append("Search on OpenFoodFacts");
  
  let itemDetailsElem = document.createElement("article");
    itemDetailsElem.append(`Barcode: ${itemId}`)
    let newlineBreak = document.createElement("br");
    itemDetailsElem.append(newlineBreak);
    itemDetailsElem.append(`Store Count: ${GLOBALItemsData.itemPricingData[itemIdx].stores.length}`)
    newlineBreak = document.createElement("br");
    itemDetailsElem.append(newlineBreak);
    itemDetailsElem.append(itemOffLink);
  
  divNode.append(headerElem)
  divNode.append(itemDetailsElem)
  newlineBreak = document.createElement("br");
  divNode.append(newlineBreak);
  
  for (var i=0; i < GLOBALDiscountData.promoIds.length; i++) {
    let itemIsInPromo = GLOBALDiscountData.promoItemIds[i].promoItemIds.includes(Number(itemId));
    if (!itemIsInPromo) {
      continue
    }
    let description = GLOBALDiscountData.promoDescription[i]
    let rate = GLOBALDiscountData.promoDiscountRate[i]
    let price = GLOBALDiscountData.promoDiscountedPrice[i]
    let endtime = GLOBALDiscountData.promoEndUnixTime[i]
    
    let relativeTimeString = new Intl.RelativeTimeFormat().format((new Date(endtime*1000) - new Date()) / (24*60*60*1000),'day') 
    //console.log(i);
    
    let pRow = document.createElement("article");
      pRow.append(description);
      newlineBreak = document.createElement("br");
      pRow.append(newlineBreak);
      pRow.append(`${rate}%`);
      newlineBreak = document.createElement("br");
      pRow.append(newlineBreak);
      pRow.append(`${price/100}\₪`);
      newlineBreak = document.createElement("br");
      pRow.append(newlineBreak);
      pRow.append(`Expiry: ${relativeTimeString}`);
    

    divNode.append(pRow);
    let horizontalBreak = document.createElement("hr");
    divNode.append(horizontalBreak);
  }

  fragment.append(divNode);
  return fragment
}

//
// Event Handlers
//

var selectedItems = new Array();
function itemSelectHandle(itemIdx,boolIsChecked){
  if (boolIsChecked) {
    selectedItems.push(itemIdx);
  } else if (!boolIsChecked) {
    //selectedItems.splice(selectedItems.indexOf(itemIdx),1);
    for (var i=0;i<selectedItems.length;i++) {
      let item = selectedItems[i]
      if (Array.isArray(item)) {
        for (var j=0;j<item.length;j++) {
          if (item[j] === itemIdx) {
            console.log(i,j,"group")
            selectedItems[i].splice(j,1);
          }
        }
      } else {
        if (item === itemIdx) {
          console.log(i,0,"global")
          selectedItems.splice(i,1);
        }
      }
    }
  }
  handlerRefreshButton();
}

function handlerItemDiscountsButton(itemId,itemIdx) {
  let dialogElem = document.getElementById('dialog');
  console.log(`Showing item detail dialog for itemIdx: ${itemIdx}`)
  let fragment = itemDiscountList(itemId,itemIdx);
  dialogElem.replaceChildren(fragment);
  dialogElem.showModal();
}

function handlerGlobalSearch(event) {
  window.SELECTED_TAB = "Globe"
  ticking = false;
  let itemsListDiv = document.getElementById(window.CONTENT_ELEMENT_ID);
  let fragment = htmlGlobalItemList(ItemsData,window.selectedItems);
  itemsListDiv.replaceChildren(fragment);
}

function handlerShoppingCart(event) {
  window.SELECTED_TAB = "Cart"
  let itemsListDiv = document.getElementById(window.CONTENT_ELEMENT_ID);
  let fragment = FragmentConstructor.shoppingCartConstructor(window.selectedItems,window.selectedItemMultiplier,ItemsData,window.GroupBeingEdited);
  itemsListDiv.replaceChildren(fragment);
}

function handlerDiscountButton(event) {
  window.SELECTED_TAB = "Discount"
  let itemsListDiv = document.getElementById(window.CONTENT_ELEMENT_ID);
  //itemsListDiv.innerHTML = "LOADING GLOBAL DISCOUNTS"
  let fragment = globalDiscountList();
  itemsListDiv.replaceChildren(fragment);
}

function handlerStoreButton(event) {
  window.SELECTED_TAB = "Store";
  ticking = false;
  if (typeof window.selectedStoreId === "undefined") {
    let itemsListDiv = document.getElementById(window.CONTENT_ELEMENT_ID);
    itemsListDiv.innerHTML = "SELECT STORE ON MAP";
  } else {
    updateItemList();
  }
}

function handlerRefreshButton() {
  console.error(window.selectedItems);
  console.error(window.hiddenItems);
  let mapStore2Price = utilSelectedItemsPrice(window.selectedItems,window.selectedItemMultiplier,window.hiddenItems);
  renderMapSelectedItemPrices(mapStore2Price);
}

// item basket group handlers
function handlerNewGroupButton(event) {
  selectedItems.push([]);
  handlerShoppingCart();
}



function handlerGroupingButton(itemIdx,itemIsInGroup,itemGroupId) {
  itemGroupId = Number(itemGroupId);
  console.log(selectedItems);
  let GLOBALTargetGroupIndex = window.GroupBeingEdited;
  console.log(GLOBALTargetGroupIndex);
  console.log(itemIdx);
  console.log(itemGroupId);
  
  if (itemIsInGroup === true) {
    console.log("Item is already in a group");
    
    var accumulatedGroupIndex = -1;
    var literalGroupIndex = -1;
    // group index to literal index
    for (var i=0; i<selectedItems.length; i++) {
      if (Array.isArray(selectedItems[i])) {
        accumulatedGroupIndex++
        if (accumulatedGroupIndex == itemGroupId) {
          literalGroupIndex = i
        }
      }
    }
    
    // remove item from group
    selectedItems[literalGroupIndex].splice(selectedItems[literalGroupIndex].indexOf(Number(itemIdx)),1);
    // add item to global list
    selectedItems.push(Number(itemIdx));
  } else {
    // if item is not in a group
    var accumulatedGroupIndex = -1;
    var literalGroupIndex = -1;
    // group index to literal index
    for (var i=0; i<selectedItems.length; i++) {
      if (Array.isArray(selectedItems[i])) {
        accumulatedGroupIndex++
        if (accumulatedGroupIndex == GLOBALTargetGroupIndex) {
          literalGroupIndex = i
        }
      }
    }

    // add item to group
    selectedItems[literalGroupIndex].push(Number(itemIdx));

    console.log(selectedItems.indexOf(Number(itemIdx)));

    //remove item from global list
    selectedItems.splice(selectedItems.indexOf(Number(itemIdx)),1);
  }
  
  console.log(selectedItems);
  handlerShoppingCart();
  handlerRefreshButton();
}




var ticking = false;
var menuside = document.getElementById("scroll-pane");
menuside.addEventListener("scroll", (event) => {
  // user rAF to debounce the scroll to the beginning of SLC
  if (window.SELECTED_TAB === "Globe") {
    if (!ticking) {
      requestAnimationFrame((event) => {
        handlerGlobalSearch(event);
      });
    }
    ticking = true;
  } else if (window.SELECTED_TAB === "Store") {
    if (!ticking) {
      requestAnimationFrame((event) => {
        handlerStoreButton(event);
      });
    }
    ticking = true;
  }
});

var searchbox = document.getElementById("search-box");

searchbox.addEventListener("input", (event) => {
  if (window.SELECTED_TAB === "Store") {
    updateItemList()
  } else if (window.SELECTED_TAB === "Globe") {
    handlerGlobalSearch()
  }
  
});

// set SEARCH_MEMO global
window.SEARCH_MEMO = {
        itemIdArray: [],
        searchQuery: "",
        result: []
      } 

function handlerGroupEditButton(event) {
  
  window.GroupBeingEdited = event.target.attributes.groupid.value
  
}

// Setup initial values
function initSetup() {
  window.CONTENT_ELEMENT_ID = "content-pane";
  
  // default cart group is -1 which means the global group
  window.GroupBeingEdited = -1;
  
  window.selectedItemMultiplier = new Map();
  
  window.hiddenItems = new Set();
  
  let content_elem = document.getElementById(window.CONTENT_ELEMENT_ID);
  content_elem.addEventListener("click", (event) => {
    handlerContentInteraction(event);
  });
  content_elem.addEventListener("change", (event) => {handlerContentInteraction(event);});
}
initSetup()

function handlerContentInteraction(event) {
  console.log(event);
  let dataType = event.target.closest('[data-action-type]').dataset.actionType;
  
  switch (dataType) {
    case "item_info": {
      let itemId = event.target.closest('[data-item-id]').dataset.itemId;
      let itemIdx = event.target.closest('[data-item-idx]').dataset.itemIdx;
      console.log("Show item info for ", itemIdx);
      handlerItemDiscountsButton(itemId,itemIdx);
      break;
    }
    case "item_selection": {
      if (event.type === "change") {
        let boolIsChecked = event.target.checked;
        let itemIdx = event.target.closest('[data-item-idx]').dataset.itemIdx;
        console.log(`Checkbox ${boolIsChecked} for ${itemIdx}`);
        itemSelectHandle(Number(itemIdx),boolIsChecked);
      }
      break;
    }
    case "item_multiplier": {
      if (event.type === "change") {
        let itemIdx = event.target.closest('[data-item-idx]').dataset.itemIdx;
        window.selectedItemMultiplier.set(itemIdx,event.target.value);
        handlerRefreshButton();
      }
      break;
    }
    case "item_visibility": {
      if (event.type === "change") {
        let boolIsChecked = event.target.checked;
        console.log(boolIsChecked);
        let itemIdx = event.target.closest('[data-item-idx]').dataset.itemIdx;
        itemIdx = Number(itemIdx);
        if (boolIsChecked === false) {
          console.log(`Added ${itemIdx} to Hidden Items`);
          window.hiddenItems.add(itemIdx);
        } else if (boolIsChecked === true) {
          console.log(`Removed ${itemIdx} from Hidden Items`);
          window.hiddenItems.delete(itemIdx);
        }
        console.log(window.hiddenItems);
        handlerRefreshButton();
      }
      break;
    }
    case "item_group": {
      let itemGroupId = event.target.closest('[data-group-id]').dataset.groupId
      let itemIdx = event.target.closest('[data-item-idx]').dataset.itemIdx;
      // TODO: Sketchy
      let itemIsInGroup = (Number(itemGroupId) !== -1)
      handlerGroupingButton(itemIdx,itemIsInGroup,itemGroupId)
      break;
    }
    case "group_edit": {
      let groupId = event.target.closest('[data-group-id]').dataset.groupId;
      console.log(`Editing group ${groupId}`);
      window.GroupBeingEdited = groupId;
      handlerShoppingCart();
      break;
    }
    case "group_delete": {
      let targetButton = event.target;
      targetButton.classList.add("red-text");
      targetButton.dataset.actionType = "group_double_delete";
      targetButton.firstChild.innerHTML = "delete_forever";
      break;
    }
    case "group_double_delete": {
      let groupId = event.target.closest('[data-group-id]').dataset.groupId;
      console.log(`Deleting group ${groupId}`);

      var accumulatedGroupIndex = -1;
      var literalGroupIndex = -1;
      // group index to literal index
      for (var i=0; i<selectedItems.length; i++) {
        if (Array.isArray(selectedItems[i])) {
          accumulatedGroupIndex++
          if (accumulatedGroupIndex == groupId) {
            literalGroupIndex = i
          }
        }
      }

      selectedItems.splice(literalGroupIndex,1);

      handlerShoppingCart();
      handlerRefreshButton();
      break;
    }
    case "item_delete": {
      let targetButton = event.target;
      targetButton.classList.add("red-text");
      targetButton.dataset.actionType = "item_double_delete";
      targetButton.firstChild.innerHTML = "delete_forever";
      break;
    }
    case "item_double_delete": {
      let itemIdx = event.target.closest('[data-item-idx]').dataset.itemIdx;
      console.log(`Deleting ${itemIdx} from cart`);
      itemSelectHandle(Number(itemIdx),false);
      handlerShoppingCart();
      break;
    }
    default: {
      console.warn("Unknown data type ",dataType);
    }
  }
}

/*
let protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles",protocol.tile);

var map = new maplibregl.Map({
  container: 'map',
  style: "map-style.json",
  //center: [34.884621314857725, 32.29040798161623], // starting position [lng, lat]
  // 32.0699,34.7882
  center: [34.7882, 32.0699], // starting position [lng, lat]
  zoom: 10 // starting zoom
});

map.showTileBoundaries = true;
*/
// create map object
var map = new maplibregl.Map({
    container: 'map', // container id
    //style: 'https://demotiles.maplibre.org/style.json', // style URL
    glyphs: "thirdparty/fonts/{fontstack}/{range}.pbf",
    center: [34.7882, 32.0699], // starting position [lng, lat]
    zoom: 10 // starting zoom
});
map.setGlyphs("thirdparty/fonts/{fontstack}/{range}.pbf")

// load unpack and render wack to map
fetch("map_data/map2.wack")
  .then(response => response.body)
  .then(rb => {
    return new Response(rb).arrayBuffer();
  })
  .then(buffer => {
    renderWackToMapObject(map,buffer);
  })
  .catch(e => console.error(e)); 

// add button controls to map 
map.on("load", ()=>{
  map.addControl(new maplibregl.NavigationControl());
});

// handle click on map
map.on("click", (event)=>{
  let clickLng = event.lngLat.lng
  let clickLat = event.lngLat.lat
  
  // NOTE: We dont use any of the conventional Geographical Distance techniques 
  // because we can expect the distances involved to be very small and
  // are only looking for the nearest point
  
  // NOTE: The current implmentation loses precision rapidly as we get to the poles
  // and doesnt work entirely if were comparing over -180,180
  
  // compute euclidian distance for all stores
  // TODO: Maybe switch to kd-tree nearest neigbour. the store locations are static anyway.
  
  var pointDistancesArray = StoresData.storeLongitudes.map((value,index)=>{
    let pointLng = value;
    let pointLat = StoresData.storeLatitudes[index];
    
    return Math.sqrt((pointLng-clickLng)**2 + (pointLat-clickLat)**2)
  });
  
  // find index of the closest store
  
  var closestStoreDistance = Infinity // start all the way out at infinity
  var closestStoreIndex = -1 // preset at -1, seems to be convention for javascript to return -1 if nothing is found
  
  for(var i=0; i < pointDistancesArray.length; i++) {
    let pointDistance = pointDistancesArray[i];
    if (pointDistance < closestStoreDistance) {
      closestStoreDistance = pointDistance;
      closestStoreIndex = i;
    }
  }
  // reset the state for the previously highlighted circle
  map.setFeatureState({source: 'storeMarkers', id: window.selectedStoreId}, { active: false });
  
  // Set the closest store and display the store items in the div
  window.selectedStoreId = StoresData.storeIds[closestStoreIndex];
  
  // highlight the current circle on the map
  map.setFeatureState({source: 'storeMarkers', id: window.selectedStoreId}, { active: true });
  // set selected tab to store
  window.SELECTED_TAB = "Store";
  updateItemList();
  
  console.log(closestStoreDistance);
  console.log(closestStoreIndex);
});

//
// BUG: this is too fast and runs before maplibre has time to load the styles
// Probably time for proper async handling
//
// Hotpatched by waiting for map idle state
//
var storeMarkersGeoJson;

var ItemsData;
var StoresData;
var PromoData;
protobuf.load("storeitems.proto", function(err, root) {
      if (err)
          throw err;

      // load Promos
      fetch("data/PromoData.binpb.zst")
        .then(response => response.body)
        .then(rb => {
          return new Response(rb).arrayBuffer();
        })
        .then(buffer => {
          const uint8Array = new Uint8Array(buffer);
          const decompressedUint8Array = fzstd.decompress(uint8Array);
          let bufferPromoData = decompressedUint8Array;
          // Obtain a message type
          var PromoDataDecoder = root.lookupType("PromoData");
          console.log("started decoding proto PromoData")


          // Decode an Uint8Array (browser) or Buffer (node) to a message
          var message = PromoDataDecoder.decode(bufferPromoData);

          var object = PromoDataDecoder.toObject(message, {
              enums: String,
              bytes: String,
          });

          // decode item pricing from indicies to literal prices
          //object.itemPricingData.forEach((element,index,array) => {
          //    array[index].pricesAtStores = element.pricesAtStores.map(priceIndex => object.itemPriceLookupArray[priceIndex]);
          //}) 
        
          PromoData = object;
          console.log("Finalized decoding promos")
        
          console.log(PromoData);
          
          //document.getElementById("download-progress").remove()
        })
        .catch(e => console.error(e)); 
  
      // load Items
      fetch("data/ItemData.binpb.zst")
        .then(response => response.body)
        .then(rb => {
          return new Response(rb).arrayBuffer();
        })
        .then(buffer => {
          const uint8Array = new Uint8Array(buffer);
          const decompressedUint8Array = fzstd.decompress(uint8Array);
          let bufferItemData = decompressedUint8Array;
          // Obtain a message type
          var itemsDataDecoder = root.lookupType("ItemData");
          console.log("started decoding proto ItemData")


          // Decode an Uint8Array (browser) or Buffer (node) to a message
          var message = itemsDataDecoder.decode(bufferItemData);

          var object = itemsDataDecoder.toObject(message, {
              enums: String,
              bytes: String,
          });

          // decode item pricing from indicies to literal prices
          //object.itemPricingData.forEach((element,index,array) => {
          //    array[index].pricesAtStores = element.pricesAtStores.map(priceIndex => object.itemPriceLookupArray[priceIndex]);
          //}) 
        
          ItemsData = object;
          console.log("Finalized decoding items")
        
          console.log(ItemsData);
          
          document.getElementById("download-progress").remove()
        })
        .catch(e => console.error(e)); 
  
  
      // load stores
      fetch("data/StoreData.binpb.zst")
        .then(response => response.body)
        .then(rb => {
          return new Response(rb).arrayBuffer();
        })
        .then(buffer => {
          const uint8Array = new Uint8Array(buffer);
          const decompressedUint8Array = fzstd.decompress(uint8Array);
          let bufferStoreData = decompressedUint8Array;
          // Obtain a message type
          var storesDataDecoder = root.lookupType("StoresData");
          console.log("started decoding proto StoresData")


          // Decode an Uint8Array (browser) or Buffer (node) to a message
          var message = storesDataDecoder.decode(bufferStoreData);

          var object = storesDataDecoder.toObject(message, {
              enums: String,
              bytes: String,
          });

          StoresData = object;
          console.log(StoresData);
        
          
          // do this before the map settles
          storeMarkersGeoJson = {
            'type': 'FeatureCollection',
            'features': [] // This should be filled with your coordinates data
          };

          StoresData.storeIds.forEach((element,index) => {
            const feature = {
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [StoresData.storeLongitudes[index], StoresData.storeLatitudes[index]]
                },
                'id': StoresData.storeIds[index]
            };
            storeMarkersGeoJson.features.push(feature);
          });
          // do this once the map settles
          map.once("idle",()=>{
            
            // visualize stores on map
            map.addSource('storeMarkers', {
                'type': 'geojson',
                'data': storeMarkersGeoJson
            });

            map.addLayer({
                'id': 'storeMarkers',
                'type': 'circle',
                'source': 'storeMarkers',
                'paint': {
                    'circle-color': [
                        "interpolate-lab",
                        ["linear"],
                        ["number",['feature-state', 'normalizedPrice'],-1],
                        // #009392,#39b185,#9ccb86,#e9e29c,#eeb479,#e88471,#cf597e
                        -1,
                        "#0000FF",
                        0,
                        "#009392",
                        0.1666,
                        "#39b185",
                        0.3333,
                        "#9ccb86",
                        0.5,
                        "#e9e29c",
                        0.6666,
                        "#eeb479",
                        0.8333,
                        "#e88471",
                        1,
                        "#cf597e"
                    ],
                    //'circle-stroke-width': 2,
                    'circle-radius' : [
                      'interpolate',
                      //['exponential', 0.5],
                      ["linear"],
                      ['zoom'],
                      6, //zoom level
                      2, //circ radius
                      18, //zoom level
                      6 //circ radius
                    ],
                    'circle-stroke-width': ['case',['boolean', ['feature-state', 'active'], false],3,0.5]
                }
            });

            // add price layer

            map.addSource('priceMarkers', {
                'type': 'geojson',
                'data': []
            });

            map.addLayer({ //TODO: Make the prices look better
                'id': 'priceMarkers',
                'type': 'symbol',
                'source': 'priceMarkers',
                'layout': {
                    'text-field': ['get', 'value'],
                  	'text-font': [ "noto_sans_bold" ],
                    'text-anchor': 'top',
                    'text-allow-overlap': false,
                    'symbol-sort-key': ['get', 'value'],
                    'text-size': ["+",16,
                                  ["*",0.0000025,
                                    ["^",["*",512000,["e"]],
                                     ["-",1,['get','normalizedPrice']]
                                    ]
                                  ]
                                 ]
                },
                "paint": {
                  "text-halo-color": "rgba(0, 0, 0, 1)",
                  "text-halo-width": 2,
                  "text-halo-blur": 1,
                  'text-color': [
                      "interpolate-lab",
                      ["linear"],
                      ["number",['get', 'normalizedPrice'],-1],
                      // #009392,#39b185,#9ccb86,#e9e29c,#eeb479,#e88471,#cf597e
                      -1,
                      "#FFFFFF",
                      0,
                      "#009392",
                      0.1666,
                      "#39b185",
                      0.3333,
                      "#9ccb86",
                      0.5,
                      "#e9e29c",
                      0.6666,
                      "#eeb479",
                      0.8333,
                      "#e88471",
                      1,
                      "#cf597e"
                  ],
                }
            });

          });
        

          console.log("Processed proto")
        })
        .catch(e => console.error(e));
});

function initializeMapLayers(mapObject,storeData) {
  
}

window.addEventListener("load", () => {
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.register("js/sw.js");
        }
      });
