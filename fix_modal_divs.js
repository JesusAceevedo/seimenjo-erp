const fs = require('fs');
const path = require('path');

const file = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'page.tsx');
let content = fs.readFileSync(file, 'utf8');

const target = `                    </>
                  )}
                </button>
                                          </form>
              )}
              </div>
            </div>
          )}

          {/* COLUMNA DERECHA: PESTAÑAS DE VISUALIZACIÓN */}`;

const replacement = `                    </>
                  )}
                </button>
              </form>
              )}
            </div>
          </div>
          )}

          {/* COLUMNA DERECHA: PESTAÑAS DE VISUALIZACIÓN */}`;

content = content.replace(target, replacement);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed divs');
