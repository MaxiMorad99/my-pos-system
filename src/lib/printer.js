import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // <--- CAMBIO 1: Importamos así

export const printTicket = (cart, total, ticketId) => {
  try {
    console.log("🖨️ Iniciando generación de PDF...");

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 200]
    });

    // Validar datos
    const safeTicketId = ticketId ? String(ticketId).slice(0, 8) : "BORRADOR";
    const safeDate = new Date().toLocaleString();

    // --- ENCABEZADO ---
    doc.setFontSize(12);
    doc.text("POS SYSTEM", 40, 10, { align: "center" });
    
    doc.setFontSize(8);
    doc.text("Morteros, Córdoba", 40, 15, { align: "center" });
    doc.text(`Fecha: ${safeDate}`, 40, 20, { align: "center" });
    doc.text(`Ref: ${safeTicketId}`, 40, 25, { align: "center" });

    doc.text("-------------------------------------------", 40, 28, { align: "center" });

    // --- TABLA ---
    const tableRows = cart.map(item => {
      const price = item.price_sell || item.price || 0; 
      const subtotal = (price * item.qty).toFixed(2);
      return [
        String(item.qty),
        String(item.name).substring(0, 15), 
        `$${subtotal}`
      ];
    });

    // <--- CAMBIO 2: Usamos la función importada pasándole el documento 'doc'
    autoTable(doc, {
      head: [['Cant', 'Prod', 'Total']],
      body: tableRows,
      startY: 30,
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 1, overflow: 'linebreak' },
      headStyles: { fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 15, halign: 'right' }
      },
      margin: { left: 2, right: 2 }
    });

    // --- TOTAL ---
    // (autoTable modifica el doc, así que podemos leer lastAutoTable del doc)
    const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 5 : 50;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL: $${Number(total).toFixed(2)}`, 75, finalY, { align: "right" });

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("¡Gracias por su compra!", 40, finalY + 10, { align: "center" });

    // Guardar
    console.log("💾 Guardando PDF...");
    doc.save(`ticket_${safeTicketId}.pdf`);
    
    return true;

  } catch (error) {
    console.error("❌ Error generando el PDF:", error);
    alert("Error generando el ticket PDF: " + error.message);
    return false;
  }
};